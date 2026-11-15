// -----
// Phext
// -----
// (c) 2024 Phext, Inc.
// Licensed under the MIT License
//
// This project was ported from https://github.com/wbic16/libphext-rs/blob/master/src/phext.rs.
// Web Site: https://phext.io/
// -----------------------------------------------------------------------------------------------------------
import { Buffer } from 'buffer';
import * as xxhash from 'xxh3-ts';
import * as lzma from 'lzma-native';

// The largest coordinate component a JS number holds exactly: 2^53 - 1.
// Phext components are format-unbounded (libphext-rs uses u64/usize), but a
// component past this limit cannot be represented exactly as a JS number —
// 9007199254740993 would silently round to 9007199254740992 and address the
// wrong scroll. Every parse and advance path therefore enforces this limit
// with an error instead of rounding (Will, 2026-11-02).
export const MAX_COMPONENT = Number.MAX_SAFE_INTEGER;

// The first (and only header) line of a binary scroll, without its line
// break — libphext-rs binary::BINARY_SCROLL_HEADER (0.5.0). A scroll whose
// content begins with this line plus its line break is a binary scroll.
export const BINARY_SCROLL_HEADER = "phext-binary:1:base64";

// The xz preset the seal encodes with — libphext-rs seal::SEAL_PRESET.
// The preset is an encoder choice, not a format requirement; seals
// produced at other presets unseal identically.
export const SEAL_PRESET = 6;

export class Phext {
	COORDINATE_MINIMUM: number;
	MAX_COMPONENT: number;
	LIBRARY_BREAK: string;
	CHAIN_BREAK: string;
	CHAIN_CLOSE: string;
	MORE_COWBELL: string;
	LINE_BREAK: string;
	SCROLL_BREAK: string;
	SECTION_BREAK: string;
	CHAPTER_BREAK: string;
	BOOK_BREAK: string;
	VOLUME_BREAK: string;
	COLLECTION_BREAK: string;
	SERIES_BREAK: string;
	SHELF_BREAK: string;
	ADDRESS_MICRO_BREAK: string;
	ADDRESS_MACRO_BREAK: string;
	ADDRESS_MACRO_ALT: string;
	constructor() {
		this.COORDINATE_MINIMUM = 1;
		this.MAX_COMPONENT = MAX_COMPONENT;
        this.LIBRARY_BREAK       = '\x01'; // 11D Break - replaces start of header
        this.CHAIN_BREAK         = '\x02'; // stream level (0.6.0) - separates whole phexts within a chain; replaces start of text
        this.CHAIN_CLOSE         = '\x03'; // stream level (0.6.0) - terminates a chain; replaces end of text
        this.MORE_COWBELL        = '\x07'; // i've got a fever, and the only prescription...is more cowbell!
        this.LINE_BREAK          = '\x0A'; // same as plain text \o/
        this.SCROLL_BREAK        = '\x17'; // 3D Break - replaces End Transmission Block
        this.SECTION_BREAK       = '\x18'; // 4D Break - replaces Cancel Block
        this.CHAPTER_BREAK       = '\x19'; // 5D Break - replaces End of Tape
        this.BOOK_BREAK          = '\x1A'; // 6D Break - replaces Substitute
        this.VOLUME_BREAK        = '\x1C'; // 7D Break - replaces file separator
        this.COLLECTION_BREAK    = '\x1D'; // 8D Break - replaces group separator
        this.SERIES_BREAK        = '\x1E'; // 9D Break - replaces record separator
        this.SHELF_BREAK         = '\x1F'; // 10D Break - replaces unit separator
        this.ADDRESS_MICRO_BREAK = '.'; // delimiter for micro-coordinates
        this.ADDRESS_MACRO_BREAK = '/'; // delimiter for macro-coordinates
        this.ADDRESS_MACRO_ALT   = ';';   // also allow ';' for url encoding
	}

	create_range = (start: Coordinate, end: Coordinate): Range => {
		return new Range(start, end);
	};

	default_coordinate = (): Coordinate => {
		return new Coordinate();
	}

	create_positioned_scroll = (coord: Coordinate, scroll: string, next: string = "", remaining: string = ""): PositionedScroll => {
		return new PositionedScroll(coord, scroll, new Coordinate(next), remaining);
	}

	check_for_cowbell = (phext: string): boolean => {
		for (var i = 0; i < phext.length; ++i) {
			if (phext[i] == this.MORE_COWBELL) {
				return true;
			}
		}
	
	  	return false;
	};

	get_subspace_coordinates = (subspace: string, target: Coordinate): OffsetsAndCoordinate => {
		var walker = new Coordinate();
  		var fallback = new Coordinate();
		var insertion = new Coordinate();
  		var subspace_index = 0;
  		var start = 0;
  		var end = 0;
  		var stage = 0;
  		var max = subspace.length;

  		while (subspace_index < max) {
    		var next = subspace[subspace_index];

    		if (stage == 0) {
      			if (walker.equals(target)) {
        			stage = 1;
        			start = subspace_index;
					fallback = this.to_coordinate(walker.to_string());
					insertion = this.to_coordinate(walker.to_string());
      			}
      			if (walker.less_than(target)) {
					fallback = this.to_coordinate(walker.to_string());
					insertion = this.to_coordinate(walker.to_string());
      			}
    		}

    		if (stage < 2 && walker.greater_than(target)) {
				if (stage == 0) {
        			start = subspace_index - 1;
      			}
				end = subspace_index - 1;
				insertion = fallback;
      			stage = 2;
    		}

    		if (this.is_phext_break(next)) {
      			if (next == this.SCROLL_BREAK)     { walker.scroll_break();     }
      			if (next == this.SECTION_BREAK)    { walker.section_break();    }
      			if (next == this.CHAPTER_BREAK)    { walker.chapter_break();    }
      			if (next == this.BOOK_BREAK)       { walker.book_break();       }
      			if (next == this.VOLUME_BREAK)     { walker.volume_break();     }
      			if (next == this.COLLECTION_BREAK) { walker.collection_break(); }
      			if (next == this.SERIES_BREAK)     { walker.series_break();     }
      			if (next == this.SHELF_BREAK)      { walker.shelf_break();      }
      			if (next == this.LIBRARY_BREAK)    { walker.library_break();    }
    		}

    		++subspace_index;
  		}

  		if (stage == 1 && walker.equals(target)) {
			end = max;
			insertion = walker;
    		stage = 2;
  		}

  		if (stage == 0) {
    		start = max;
    		end = max;
			insertion = walker;
  		}

		var result = new OffsetsAndCoordinate(start, end, insertion, fallback);
		return result;
	};

	remove = (phext: string, location: Coordinate): string => {
		var phase1 = this.replace(phext, location, "");
  		return this.normalize(phase1);
	};

	create_summary = (phext: string): string => {
  		var limit = 32;
		if (phext.length == 0) { return "No Summary"; }

		const parts = this.phokenize(phext);
		const text = parts[0].scroll.split('\n')[0];
		if (text.length < 32) { limit = text.length; }
		var result = text.substring(0, limit);
		if (result.length < phext.length) {
			result += "...";
		}
		return result;
	};

	navmap = (urlbase: string, phext: string): string => {
		const phokens = this.phokenize(phext);
		var result = "";
		const max = phokens.length;
		if (max > 0) {
			result += "<ul>\n";
	   	}
		for (var i = 0; i < max; ++i) {
			const phoken = phokens[i];
			const urle = phoken.coord.to_urlencoded();
			const address = phoken.coord.to_string();
			const summary = this.create_summary(phoken.scroll);
			result += `<li><a href=\"${urlbase}${urle}\">${address} ${summary}</a></li>\n`;
		}
  		if (max > 0) {
    		result += "</ul>\n";
  		}

  		return result;
	};

	textmap = (phext: string): string => {
		var phokens = this.phokenize(phext);
  		var result = '';
  		for (var i = 0; i < phokens.length; ++i) {
			var phoken = phokens[i];
    		result += `* ${phoken.coord.to_string()}: ${this.create_summary(phoken.scroll)}\n`;
  		}

  		return result;
	};

	// XXH3-128 checksum, byte-identical to libphext-rs (xxhash-rust 0.8.5).
	// This was disabled while xxh3-ts lagged the reference; xxh3-ts 2.0.1 (a
	// pure-TS port, no native code — it bundles where xxhash-addon could not)
	// reproduces rs exactly on every XXH3 length class: 0-3, 4-8, 9-16,
	// 17-128, 129-240, >240 bytes, multi-KB, and unicode inputs, all measured
	// against the rs build. It consumes a Node-style Buffer; in browsers the
	// 'buffer' package (a dependency of this library) provides one.
	checksum = (phext: string): string => {
		const buffer = Buffer.from(phext);
		const hash = xxhash.XXH3_128(buffer);
		return hash.toString(16).padStart(32, '0');
	};

	// Replace every scroll in the document with its checksum — rs's manifest().
	manifest = (phext: string): string => {
		var phokens = this.phokenize(phext);
		for (var i = 0; i < phokens.length; ++i) {
			phokens[i].scroll = this.checksum(phokens[i].scroll);
		}

		return this.dephokenize(phokens);
	};

	soundex_internal = (buffer: string): number => {
		var letter1 = "bpfv";
		var letter2 = "cskgjqxz";
		var letter3 = "dt";
		var letter4 = "l";
		var letter5 = "mn";
		var letter6 = "r";

		var value = 1; // 1-100
		for (var i = 0; i < buffer.length; ++i) {
		  var c = buffer[i];
		  if (letter1.indexOf(c) >= 0) { value += 1; continue; }
		  if (letter2.indexOf(c) >= 0) { value += 2; continue; }
		  if (letter3.indexOf(c) >= 0) { value += 3; continue; }
		  if (letter4.indexOf(c) >= 0) { value += 4; continue; }
		  if (letter5.indexOf(c) >= 0) { value += 5; continue; }
		  if (letter6.indexOf(c) >= 0) { value += 6; continue; }
		}

		return value % 99;
	};

	soundex_v1 = (phext: string): string => {
		var phokens = this.phokenize(phext);

		var result = "";
		var coord = new Coordinate();
		for (var i = 0; i < phokens.length; ++i) {
			const soundex = this.soundex_internal(phokens[i].scroll);
			result += coord.advance_to(phokens[i].coord);
			result += soundex;
		}

		return result;
	};

	index_phokens = (phext: string): Array<PositionedScroll> => {
		var phokens = this.phokenize(phext);
		var offset = 0;
		var coord = new Coordinate();
		var output = new Array();
		for (var i = 0; i < phokens.length; ++i) {
		  const delims = coord.advance_to(phokens[i].coord);
		  offset += utf8_length(delims);
		  const new_coord = new Coordinate(coord.to_string());
		  output.push(new PositionedScroll(new_coord, `${offset}`, new_coord, ""));
		  offset += utf8_length(phokens[i].scroll);
		}

		return output;
	};

	index = (phext: string): string => {
		var output = this.index_phokens(phext);
		return this.dephokenize(output);
	};

	offset = (phext: string, coord: Coordinate): number => {
		var output = this.index_phokens(phext);

		var best = new Coordinate();
		var matched = false;
		var fetch_coord = coord;
		for (var i = 0; i < output.length; ++i) {
			var phoken = output[i];
		 	if (phoken.coord.less_than(coord) || phoken.coord.equals(coord)) {
				best = phoken.coord;
		  	}
		  	if (phoken.coord == coord) {
				matched = true;
		  	}
		}

		if (matched == false) {
		  fetch_coord = best;
		}
		let index = this.dephokenize(output);

		return parseInt(this.fetch(index, fetch_coord));
	};

	replace = (phext: string, location: Coordinate, scroll: string): string => {
		const phokens = this.phokenize(phext);
		var coord = new Coordinate();
		var result = "";
		var inserted = scroll.length == 0;
		
		for (var i = 0; i < phokens.length; ++i) {
			var ith = phokens[i];
			if (ith.coord.equals(location)) {
				if (!inserted) {
					result += coord.advance_to(location);
					result += scroll;
					inserted = true;
				}
			} else {
				if (inserted == false && ith.coord.greater_than(location))
				{
					result += coord.advance_to(location);
					result += scroll;
					inserted = true;
				}

				if (ith.scroll.length > 0) {
					result += coord.advance_to(ith.coord);
					result += ith.scroll;
				}
			}
		}
		
		if (inserted == false)
		{
			result += coord.advance_to(location);
			result += scroll;
			inserted = true;
		}

		return result;
	};

	range_replace = (phext: string, location: Range, scroll: string): string => {
  		var parts_start = this.get_subspace_coordinates(phext, location.start);
  		var parts_end = this.get_subspace_coordinates(phext, location.end);
  		var start = parts_start.start;
  		var end = parts_end.end;
		const max = phext.length;
		if (end > max) { end = max; }
		const left = phext.substring(0, start);
		const right = phext.substring(end);
		const result = left + scroll + right;
		return result;
	};

	insert = (buffer: string, location: Coordinate, scroll: string): string => {
  		var parts = this.get_subspace_coordinates(buffer, location);
  		const end = parts.end;
  		var fixup = "";
  		var subspace_coordinate = parts.coord;

		fixup += subspace_coordinate.advance_to(location);

  		const left = buffer.substring(0, end);
  		const right = buffer.substring(end);
		const result = left + fixup + scroll + right;
		return result;
	};

	next_scroll = (phext: string, start: Coordinate): PositionedScroll => {
		var location = start;
  		var output = "";
  		var remaining = "";
		var pi = 0;
		var begin = start;
  		var pmax = phext.length;
  		while (pi < pmax) {
    		var test = phext[pi];
    		var dimension_break = false;
    		if (test == this.SCROLL_BREAK)     { location.scroll_break();     dimension_break = true; }
    		if (test == this.SECTION_BREAK)    { location.section_break();    dimension_break = true; }
    		if (test == this.CHAPTER_BREAK)    { location.chapter_break();    dimension_break = true; }
    		if (test == this.BOOK_BREAK)       { location.book_break();       dimension_break = true; }
    		if (test == this.VOLUME_BREAK)     { location.volume_break();     dimension_break = true; }
    		if (test == this.COLLECTION_BREAK) { location.collection_break(); dimension_break = true; }
    		if (test == this.SERIES_BREAK)     { location.series_break();     dimension_break = true; }
    		if (test == this.SHELF_BREAK)      { location.shelf_break();      dimension_break = true; }
    		if (test == this.LIBRARY_BREAK)    { location.library_break();    dimension_break = true; }

    		if (dimension_break) {
      			if (output.length > 0) {
        			pi += 1;
        			break;
      			}
    		} else {
      			begin = new Coordinate(location.to_string());
      			output += phext[pi];
    		}
    		++pi;
  		}

		if (pi < pmax) {
			remaining = phext.substring(pi);
		}

  		const out_scroll = new PositionedScroll(begin, output, location, remaining);
  		return out_scroll;
	};

	phokenize = (phext: string): Array<PositionedScroll> => {
		var result = Array();
  		var coord = new Coordinate();
		
		var temp = phext;
		while (true) {
			var ith_result = this.next_scroll(temp, coord);
			if (ith_result.scroll.length == 0)
			{
				break;
			}
			result.push(ith_result);
			coord = ith_result.next;
			temp = ith_result.remaining;
			if (ith_result.remaining.length == 0) {
				break;
			}
		}

  		return result;
	};

	merge = (left: string, right: string): string => {
		const tl = this.phokenize(left);
		const tr = this.phokenize(right);
		var tli = 0;
		var tri = 0;
 		const maxtl = tl.length;
  		const maxtr = tr.length;
  		var result = "";
  		var coord = new Coordinate();

  		while (true) {
    		const have_left = tli < maxtl;
    		const have_right = tri < maxtr;
    
			const tl_lte = have_left && have_right && (tl[tli].coord.less_than(tr[tri].coord) ||
			               tl[tli].coord.equals(tr[tri].coord));
			const tr_lte = have_left && have_right && (tr[tri].coord.less_than(tl[tli].coord) ||
			               tr[tri].coord.equals(tl[tli].coord));

    		const pick_left = have_left && (have_right == false || tl_lte);
    		const pick_right = have_right && (have_left == false || tr_lte);

    		if (pick_left) {
      			result += this.append_scroll(tl[tli], coord);
      			coord = new Coordinate(tl[tli].coord.to_string());
      			++tli;
    		}
    		if (pick_right) {
      			result += this.append_scroll(tr[tri], coord);				
      			coord = new Coordinate(tr[tri].coord.to_string());
    			++tri;
    		}

    		if (pick_left == false && pick_right == false) {
    			break;
    		}
  		}

  		return result;
	};

	fetch = (phext: string, target: Coordinate): string => {
  		var parts = this.get_subspace_coordinates(phext, target);
  		var start = parts.start;
  		var end = parts.end;

  		if (end > start)
  		{
			var result = phext.substring(start, end);
			return result;
  		}

  		return "";
	};

	expand = (phext: string): string => {
		var result = "";
		for (var i = 0; i < phext.length; ++i) {
			var next = phext[i];
			switch (next) {
				case this.LINE_BREAK: result += this.SCROLL_BREAK; break;
				case this.SCROLL_BREAK: result += this.SECTION_BREAK; break;
				case this.SECTION_BREAK: result += this.CHAPTER_BREAK; break;
				case this.CHAPTER_BREAK: result += this.BOOK_BREAK; break;
				case this.BOOK_BREAK: result += this.VOLUME_BREAK; break;
				case this.VOLUME_BREAK: result += this.COLLECTION_BREAK; break;
				case this.COLLECTION_BREAK: result += this.SERIES_BREAK; break;
				case this.SERIES_BREAK: result += this.SHELF_BREAK; break;
				case this.SHELF_BREAK: result += this.LIBRARY_BREAK; break;
				default: result += phext[i]; break;
				// nop: phext.LIBRARY_BREAK
			}
		}		
		return result;
	};

	contract = (phext: string): string => {
		var result = "";
		for (var i = 0; i < phext.length; ++i) {
			var next = phext[i];
			switch (next)
			{
				// nop: case phext.LINE_BREAK
				case this.SCROLL_BREAK: result += this.LINE_BREAK; break;
				case this.SECTION_BREAK: result += this.SCROLL_BREAK; break;
				case this.CHAPTER_BREAK: result += this.SECTION_BREAK; break;
				case this.BOOK_BREAK: result += this.CHAPTER_BREAK; break;
				case this.VOLUME_BREAK: result += this.BOOK_BREAK; break;
				case this.COLLECTION_BREAK: result += this.VOLUME_BREAK; break;
				case this.SERIES_BREAK: result += this.COLLECTION_BREAK; break;
				case this.SHELF_BREAK: result += this.SERIES_BREAK; break;
				case this.LIBRARY_BREAK: result += this.SHELF_BREAK; break;
				default: result += phext[i]; break;
			}
		}
		
		return result;
	};

	dephokenize = (phokens: Array<PositionedScroll>): string => {
		var result = "";
  		var coord = new Coordinate();
		for (var i = 0; i < phokens.length; ++i)
		{
			var ph = phokens[i];
			if (ph.scroll && ph.scroll.length > 0) {
				result += coord.advance_to(ph.coord);
				result += ph.scroll;
			}
		}
  		return result;
	};

	append_scroll = (token: PositionedScroll, coord: Coordinate): string => {
		var output = coord.advance_to(token.coord);
		output += token.scroll;
  		return output;
	};

	subtract = (left: string, right: string): string => {
		const pl = this.phokenize(left);
  		const pr = this.phokenize(right);
  		var result = "";
  		var pri = 0;
  		const max = pr.length;
		var coord = new Coordinate();
  		for (var i = 0; i < pl.length; ++i) {
			var token = pl[i];
    		var do_append = false;
    		if (pri == max) {
      			do_append = true;
    		}

    		if (pri < max) {
      			let compare = pr[pri];
      			if (token.coord.less_than(compare.coord)) {
        			do_append = true;
      			} else if (token.coord.equals(compare.coord)) {
        			++pri;
      			}
    		}

    		if (do_append) {
      			result += this.append_scroll(token, coord);
      			coord.advance_to(token.coord);
    		}
  		}

  		return result;
	};

	is_phext_break = (byte: string): boolean => {
		return byte == this.LINE_BREAK ||
				byte == this.SCROLL_BREAK ||
				byte == this.SECTION_BREAK ||
				byte == this.CHAPTER_BREAK ||
				byte == this.BOOK_BREAK ||
				byte == this.VOLUME_BREAK ||
				byte == this.COLLECTION_BREAK ||
				byte == this.SERIES_BREAK ||
				byte == this.SHELF_BREAK ||
				byte == this.LIBRARY_BREAK;
	};

	normalize = (phext: string): string => {
		var arr = this.phokenize(phext);
		return this.dephokenize(arr);
	};

	// Explode a phext document into a Map from canonical coordinate strings
	// ("1.1.1/1.1.1/1.1.1") to scroll text — the JS counterpart of libphext-rs's
	// explode(). rs keys a HashMap by Coordinate; a JS Map keys primitives by
	// value, so the canonical string is the key here. Coordinate.to_string()
	// produces it and new Coordinate(key) parses it back; Coordinate.equals()
	// gives the value-equality story.
	explode = (phext: string): Map<string, string> => {
		var result = new Map<string, string>();
		const phokens = this.phokenize(phext);
		for (var i = 0; i < phokens.length; ++i) {
			result.set(phokens[i].coord.to_string(), phokens[i].scroll);
		}
		return result;
	};

	// Serialize a Map of coordinate strings to scroll text back into a phext
	// document — the counterpart of rs's implode(). Entries are sorted by
	// coordinate before serialization. Entries with empty scroll text are
	// dropped, exactly as rs's implode drops them via dephokenize.
	implode = (map: Map<string, string>): string => {
		var phokens = new Array<PositionedScroll>();
		map.forEach((scroll, address) => {
			phokens.push(new PositionedScroll(new Coordinate(address), scroll, new Coordinate(), ""));
		});
		phokens.sort((a, b) => {
			if (a.coord.less_than(b.coord)) { return -1; }
			if (a.coord.greater_than(b.coord)) { return 1; }
			return 0;
		});
		return this.dephokenize(phokens);
	};

	to_coordinate = (address: string): Coordinate => {
		var result = new Coordinate();
		var index = 0;
		var value = 0;
		var exp = 10;
		for (var i = 0; i < address.length; ++i) {
			var byte = address[i];

			if (byte == this.ADDRESS_MICRO_BREAK ||
				byte == this.ADDRESS_MACRO_BREAK ||
				byte == this.ADDRESS_MACRO_ALT) {
				switch (index) {
				  case 1: result.z.library = sanitize_component(value); index += 1; break;
				  case 2: result.z.shelf = sanitize_component(value); index += 1; break;
				  case 3: result.z.series = sanitize_component(value); index += 1; break;
				  case 4: result.y.collection = sanitize_component(value); index += 1; break;
				  case 5: result.y.volume = sanitize_component(value); index += 1; break;
				  case 6: result.y.book = sanitize_component(value); index += 1; break;
				  case 7: result.x.chapter = sanitize_component(value); index += 1; break;
				  case 8: result.x.section = sanitize_component(value); index += 1; break;
				}
				value = 0;
			}

			if (byte >= '0' && byte <= '9')
			{
				value = exp * value + parseInt(byte);
				if (value > MAX_COMPONENT) {
					throw new Error(`libphext: coordinate component in "${address}" exceeds MAX_COMPONENT (${MAX_COMPONENT}) — a JS number cannot represent it exactly`);
				}
				if (index == 0) { index = 1; }
			}
		}

  		if (index > 0) {
    		result.x.scroll = sanitize_component(value);
  		}

  		return result;
	};

	// -------------------------------------------------------------------------------------------------------
	// Binary scrolls (0.5.0) — ported 1:1 from libphext-rs src/binary.rs.
	//
	// Phext scrolls are text (valid UTF-8). Arbitrary binary data rides as
	// text via base64, in the one canonical binary scroll format:
	//
	//   phext-binary:1:base64
	//   <base64 body>
	//
	// Line 1 is exactly `phext-binary:1:base64` plus a single line break.
	// The body is RFC 4648 base64: standard alphabet, padding required, no
	// line wrapping, no whitespace. An empty payload is the header line
	// alone. A scroll whose content begins with the header line is a binary
	// scroll by definition; a prefix-matching scroll whose body is not
	// strict base64 is a *malformed* binary scroll.
	//
	// The ingestion rule (canonical behaviour, all ports): when non-UTF-8
	// data is observed in an incoming scroll update, we encode it with
	// base64 verbatim. Byte-oriented entry points (insert_bytes,
	// replace_bytes, ingest) never reject and never throw on non-UTF-8
	// scroll data: valid UTF-8 is stored as ordinary text; anything else is
	// stored as a binary scroll holding the base64 of the exact observed
	// bytes — verbatim, with no normalisation — so the matching fetch
	// returns the original bytes exactly.
	// -------------------------------------------------------------------------------------------------------

	// true when `scroll` carries the binary scroll header. Decoding
	// success is a separate question — see decode_scroll.
	is_binary_scroll = (scroll: string): boolean => {
		return scroll.startsWith(BINARY_SCROLL_PREFIX);
	};

	// encodes raw bytes as a binary scroll (header line + base64 body)
	encode_scroll = (payload: Buffer | Uint8Array): string => {
		return BINARY_SCROLL_PREFIX + Buffer.from(payload).toString('base64');
	};

	// decodes a binary scroll back to its raw bytes. Returns null when the
	// scroll is not a binary scroll, or when its body is not strict base64.
	decode_scroll = (scroll: string): Buffer | null => {
		if (!scroll.startsWith(BINARY_SCROLL_PREFIX)) { return null; }
		const body = scroll.substring(BINARY_SCROLL_PREFIX.length);
		return strict_base64_decode(body);
	};

	// stores `payload` at `location` as a binary scroll, unconditionally:
	// the caller has declared this scroll binary, even if the bytes happen
	// to be valid UTF-8.
	insert_binary = (input: string, location: Coordinate, payload: Buffer | Uint8Array): string => {
		return this.insert(input, location, this.encode_scroll(payload));
	};

	// replaces the scroll at `location` with `payload`, stored as a binary
	// scroll (see insert_binary).
	replace_binary = (input: string, location: Coordinate, payload: Buffer | Uint8Array): string => {
		return this.replace(input, location, this.encode_scroll(payload));
	};

	// retrieves the bytes held at `target`. A well-formed binary scroll
	// decodes to its payload. Any other scroll — plain text, a malformed
	// binary scroll, or no scroll at all — yields the scroll's own UTF-8
	// bytes (empty when the coordinate is unoccupied), mirroring how
	// fetch returns "" there. This function is total: it never throws and
	// never loses scroll content.
	fetch_binary = (input: string, target: Coordinate): Buffer => {
		const scroll = this.fetch(input, target);
		const decoded = this.decode_scroll(scroll);
		if (decoded !== null) { return decoded; }
		return Buffer.from(scroll, 'utf-8');
	};

	// byte-oriented insert: stores `payload` at `location` under the
	// ingestion rule (UTF-8 as text, non-UTF-8 as a base64-verbatim binary
	// scroll).
	insert_bytes = (input: string, location: Coordinate, payload: Buffer | Uint8Array): string => {
		return this.insert(input, location, stored_form(this, payload));
	};

	// byte-oriented replace: stores `payload` at `location` under the
	// ingestion rule (UTF-8 as text, non-UTF-8 as a base64-verbatim binary
	// scroll).
	replace_bytes = (input: string, location: Coordinate, payload: Buffer | Uint8Array): string => {
		return this.replace(input, location, stored_form(this, payload));
	};

	// the byte-level twin of phokenize: walks a raw byte stream and
	// returns each scroll's coordinate and raw bytes, with identical
	// segmentation. Dimension-break bytes are ASCII, so byte offsets are
	// exact; scroll bodies are returned uninterpreted, valid UTF-8 or not.
	// A literal translation of libphext-rs binary::phokenize_bytes.
	phokenize_bytes = (input: Buffer | Uint8Array): Array<ByteScroll> => {
		const data = Buffer.from(input);
		const result: Array<ByteScroll> = [];
		const max = data.length;
		var coord = new Coordinate();
		var pi = 0;
		while (true) {
			const begin0 = new Coordinate(coord.to_string());
			var begin = begin0;
			var text_start = -1;
			var text_end = max;
			while (pi < max) {
				const byte = data[pi];
				if (is_structural_break(byte)) {
					apply_break(coord, byte);
					if (text_start >= 0) {
						text_end = pi;
						pi += 1;
						break;
					}
				} else if (text_start < 0) {
					text_start = pi;
					begin = new Coordinate(coord.to_string());
				}
				pi += 1;
			}
			const scroll = text_start >= 0 ? Buffer.from(data.subarray(text_start, text_end)) : Buffer.alloc(0);
			result.push({ coord: begin, bytes: scroll });
			if (pi >= max) { break; }
		}
		return result;
	};

	// ingests an externally supplied phext byte stream. Every scroll is
	// observed as raw bytes: valid UTF-8 scrolls pass through verbatim, and
	// any scroll whose bytes are not valid UTF-8 is stored as a binary
	// scroll holding the base64 of the exact observed bytes (the ingestion
	// rule), so fetch_binary at its coordinate returns the original bytes
	// exactly. Never rejects, never throws. The result is the canonical
	// serialization (the same normal form as implode of explode).
	ingest = (data: Buffer | Uint8Array): string => {
		const parts = this.phokenize_bytes(data);
		const map = new Map<string, string>();
		for (const part of parts) {
			const text = try_utf8_decode(part.bytes);
			map.set(part.coord.to_string(), text !== null ? text : this.encode_scroll(part.bytes));
		}
		return this.implode(map);
	};

	// -------------------------------------------------------------------------------------------------------
	// Chains (0.6.0) — ported 1:1 from libphext-rs src/phext.rs (chain
	// layer + multiverse addressing).
	//
	// A chain is an ordered series of complete phexts within one stream,
	// joined by CHAIN_BREAK (0x02) and optionally terminated by CHAIN_CLOSE
	// (0x03). The chain layer is a stream-level layer, one rung above the
	// library break: the nine dimension breaks structure a single phext,
	// while the two chain bytes structure a stream of phexts. Each member
	// is a whole phext; read in succession, a chain's members are editions
	// in sequence — the chain is how a phext stream encodes time.
	//
	// `closed` records how the chain ended: true when a CHAIN_CLOSE
	// terminated it, false when the stream simply ran out (EOF). A chain
	// that ends at EOF is unclosed — possibly truncated — and is never
	// silently promoted to closed. A stream with no chain bytes at all is
	// a single unclosed chain holding one member phext: every pre-0.6
	// phext reads this way.
	//
	// Multiverse addressing: inside a chain, members are universes indexed
	// from 1. "$N:<address>" fetches the scroll at <address> in universe N
	// of that chain; a bare <address> means universe 1.
	// -------------------------------------------------------------------------------------------------------

	// splits a stream into its chains. CHAIN_BREAK separates the member
	// phexts of a chain; CHAIN_CLOSE terminates a chain, and whatever
	// follows it opens the next one — so one stream may hold many chains.
	// The stream's final chain is closed only when the stream ends with
	// CHAIN_CLOSE. Splitting follows split semantics, so empty members
	// and empty chains are preserved exactly: parse and serialize are
	// byte-exact inverses for every stream.
	parse_chains = (input: string): Array<Chain> => {
		const ends_closed = input.endsWith(this.CHAIN_CLOSE);
		var segments = input.split(this.CHAIN_CLOSE);
		if (ends_closed) {
			// split preserves the empty tail after a trailing delimiter;
			// that tail is the end of the stream, not another chain
			segments.pop();
		}
		const count = segments.length;
		const chains: Array<Chain> = [];
		for (var i = 0; i < count; ++i) {
			const closed = ends_closed || (i + 1 < count);
			chains.push(new Chain(segments[i].split(this.CHAIN_BREAK), closed));
		}
		return chains;
	};

	// serializes a stream of chains back into stream bytes: the inverse
	// of parse_chains.
	serialize_chains = (chains: Array<Chain>): string => {
		var result = "";
		for (const chain of chains) {
			result += chain.serialize();
		}
		return result;
	};

	// parses a multiverse address into [universe, coordinate], or null
	// when the universe prefix is malformed ($0:, a missing colon, or a
	// non-numeric universe). A bare address is universe 1.
	parse_universe_address = (address: string): [number, Coordinate] | null => {
		var universe = 1;
		var coord_part = address;
		if (address.startsWith('$')) {
			const rest = address.substring(1);
			const colon = rest.indexOf(':');
			if (colon < 0) { return null; }
			const num = rest.substring(0, colon);
			// mirror Rust's usize parse: ASCII digits only, at least one
			if (!/^[0-9]+$/.test(num)) { return null; }
			universe = parseInt(num, 10);
			if (universe < 1) { return null; }
			coord_part = rest.substring(colon + 1);
		}
		return [universe, this.to_coordinate(coord_part)];
	};

	// -------------------------------------------------------------------------------------------------------
	// Line/column addressing (0.6.1) — ported 1:1 from libphext-rs
	// src/phext.rs (the addressing section at the end of that file).
	//
	// A point address is "[$N:]<9D coordinate>@<line>,<column>": the
	// multiverse prefix and the coordinate exactly as in
	// parse_universe_address, plus a within-scroll caret position. Line
	// and column are 1-based; a position names a caret boundary (column 1
	// is the boundary before the line's first character; a line of n
	// characters has valid columns 1..n+1), and columns count Unicode
	// scalar values — JS strings are UTF-16, so all counting here walks
	// code points (for..of / Array.from), never .length or indexing. A
	// point may carry "+<offsetChars>": select forward that many
	// characters (scalars) from the point, counted within the scroll,
	// terminating at the scroll boundary.
	//
	// A range address is two point addresses joined by one hyphen:
	// "<point>-<point>". The endpoints may span scrolls and universes; an
	// endpoint without "@" names its whole scroll (as start: its first
	// boundary; as end: its last). Canonical form: endpoints in ascending
	// (universe, coordinate, line, column) order — direction is
	// discarded — "$1:" never written, integers in minimal decimal form.
	// Out-of-range endpoints fail at resolution, never clamp.
	// -------------------------------------------------------------------------------------------------------

	// parses a v0.6.1 point address:
	// "[$N:]<coordinate>[@<line>,<column>[+<offsetChars>]]". Returns null
	// on any malformed input: universe 0, a coordinate component below
	// 1, a line or column below 1, a sign anywhere, or trailing
	// structure. "$1:" is accepted on input; the canonical serialized
	// form never emits it.
	parse_point_address = (address: string): PointAddress | null => {
		var universe = 1;
		var rest = address;
		if (address.startsWith('$')) {
			const stripped = address.substring(1);
			const colon = stripped.indexOf(':');
			if (colon < 0) { return null; }
			const n = parse_address_uint(stripped.substring(0, colon));
			if (n === null || n < 1) { return null; }
			universe = n;
			rest = stripped.substring(colon + 1);
		}
		var coord_part = rest;
		var pos_part: string | null = null;
		const at_index = rest.indexOf('@');
		if (at_index >= 0) {
			coord_part = rest.substring(0, at_index);
			pos_part = rest.substring(at_index + 1);
			if (pos_part.indexOf('@') >= 0) { return null; }
		}
		const coordinate = parse_address_coordinate(coord_part);
		if (coordinate === null) { return null; }
		var position: ScrollPosition | null = null;
		var offset: number | null = null;
		if (pos_part !== null) {
			const comma = pos_part.indexOf(',');
			if (comma < 0) { return null; }
			const line = parse_address_uint(pos_part.substring(0, comma));
			if (line === null) { return null; }
			const col_part = pos_part.substring(comma + 1);
			var col_text = col_part;
			var offset_value: number | null = null;
			const plus = col_part.indexOf('+');
			if (plus >= 0) {
				col_text = col_part.substring(0, plus);
				offset_value = parse_address_uint(col_part.substring(plus + 1));
				if (offset_value === null) { return null; }
			}
			const column = parse_address_uint(col_text);
			if (column === null) { return null; }
			if (line < 1 || column < 1) { return null; }
			position = { line: line, column: column };
			offset = offset_value;
		}
		return { universe: universe, coordinate: coordinate, position: position, offset: offset };
	};

	// parses a v0.6.1 range address: exactly two point addresses joined
	// by one hyphen. The endpoints are normalized to ascending order
	// (direction is discarded, per the ratified spec). Range endpoints
	// may not carry a "+offset" — the offset form never takes a second
	// endpoint. Returns null on malformed input.
	parse_range_address = (address: string): RangeAddress | null => {
		const dash = address.indexOf('-');
		if (dash < 0) { return null; }
		const first = address.substring(0, dash);
		const second = address.substring(dash + 1);
		if (second.indexOf('-') >= 0) { return null; }
		const a = this.parse_point_address(first);
		if (a === null) { return null; }
		const b = this.parse_point_address(second);
		if (b === null) { return null; }
		if (a.offset !== null || b.offset !== null) { return null; }
		if (endpoint_cmp(a, true, b, false) > 0) {
			return { start: b, end: a };
		}
		return { start: a, end: b };
	};

	// the canonical serialization of a point address (the counterpart of
	// libphext-rs's Display for PointAddress): "$1:" never written,
	// integers in minimal decimal form.
	serialize_point_address = (point: PointAddress): string => {
		var result = "";
		if (point.universe > 1) { result += `$${point.universe}:`; }
		result += point.coordinate.to_string();
		if (point.position !== null) {
			result += `@${point.position.line},${point.position.column}`;
			if (point.offset !== null) { result += `+${point.offset}`; }
		}
		return result;
	};

	// the canonical serialization of a range address: its two endpoints
	// in ascending order, joined by one hyphen.
	serialize_range_address = (range: RangeAddress): string => {
		return `${this.serialize_point_address(range.start)}-${this.serialize_point_address(range.end)}`;
	};

	// The scroll text at a coordinate in one member phext, in the
	// phokenize sense of presence: a coordinate is present exactly when
	// phokenize enumerates it. The byte-level walker carries the
	// reference enumeration (the text phokenize stops at the first empty
	// scroll — see the chain-fixture suite), so presence and text are
	// read from phokenize_bytes; member text is valid UTF-8, so each
	// enumerated scroll's bytes decode back exactly.
	addressed_scroll_text = (member: string, target: Coordinate): string | null => {
		const scrolls = this.phokenize_bytes(Buffer.from(member, 'utf-8'));
		for (const s of scrolls) {
			if (s.coord.equals(target)) { return s.bytes.toString('utf-8'); }
		}
		return null;
	};

	// -------------------------------------------------------------------------------------------------------
	// The xz seal (0.5.0) — semantics ported 1:1 from libphext-rs
	// src/seal.rs; call shape adapted to the Node binding.
	//
	// Compression is a seal, not a working format. A phext is authored,
	// edited, and queried as plain text; when a phext is finished —
	// archived, published, or transported — it may be sealed:
	// xz-compressed as a whole. Unsealing restores the exact original
	// bytes.
	//
	// * The seal is a standard xz stream (liblzma, via the lzma-native
	//   binding) over the phext's exact bytes. Decoders in any
	//   implementation must accept any valid xz stream.
	// * This implementation encodes at preset 6 with the CRC64 check —
	//   the same encoder settings as libphext-rs (xz2 preset 6, CRC64) —
	//   so sealed bytes are byte-identical across implementations for the
	//   same input. The preset is an encoder choice, not a format
	//   requirement; seals produced at other presets unseal identically.
	// * Sealing is deterministic for a given encoder and preset.
	//
	// Call shape: lzma-native exposes compression only through its
	// async (callback/promise) API — there is no synchronous entry point —
	// so the seal functions return Promises where the Rust functions
	// return values. The byte format is unchanged.
	// -------------------------------------------------------------------------------------------------------

	// seals a phext: xz-compresses its full UTF-8 bytes.
	seal = async (input: string): Promise<Buffer> => {
		return this.seal_bytes(Buffer.from(input, 'utf-8'));
	};

	// seals raw phext bytes (see seal).
	seal_bytes = async (input: Buffer | Uint8Array): Promise<Buffer> => {
		return lzma.compress(Buffer.from(input), { preset: SEAL_PRESET, check: LZMA_CHECK_CRC64 });
	};

	// unseals a sealed phext back to its exact original bytes. Rejects
	// when the data is not a valid xz stream.
	unseal = async (data: Buffer | Uint8Array): Promise<Buffer> => {
		return lzma.decompress(Buffer.from(data));
	};

	// unseals directly to text. Rejects when the unsealed bytes are not
	// valid UTF-8; to unseal foreign content that may carry non-UTF-8
	// scrolls, unseal to bytes and pass them through ingest, which
	// applies the base64-verbatim ingestion rule instead of failing.
	unseal_string = async (data: Buffer | Uint8Array): Promise<string> => {
		const bytes = await this.unseal(data);
		const text = try_utf8_decode(bytes);
		if (text === null) {
			throw new Error("libphext: unsealed bytes are not valid UTF-8");
		}
		return text;
	};
}

// One scroll of a byte-level phokenize: its coordinate and its raw bytes,
// uninterpreted (valid UTF-8 or not).
export interface ByteScroll {
	coord: Coordinate;
	bytes: Buffer;
}

// A chain (0.6.0): an ordered series of complete phexts within one stream,
// joined by CHAIN_BREAK (0x02) and optionally terminated by CHAIN_CLOSE
// (0x03). See Phext.parse_chains for the full semantics.
export class Chain {
	members: Array<string>;
	closed: boolean;
	constructor(members: Array<string> = [], closed: boolean = false) {
		this.members = members;
		this.closed = closed;
	}

	// serializes this chain alone: its members joined by CHAIN_BREAK,
	// with a trailing CHAIN_CLOSE when the chain is closed. See
	// Phext.serialize_chains for whole streams.
	serialize = (): string => {
		var result = this.members.join(__internal_phext.CHAIN_BREAK);
		if (this.closed) { result += __internal_phext.CHAIN_CLOSE; }
		return result;
	};

	// Fetch a scroll by multiverse address: "$N:coord", or a bare
	// coordinate (universe 1). Out-of-range universes, malformed universe
	// prefixes, and missing scrolls all yield an empty string, as fetch
	// does for a missing scroll.
	fetch = (address: string): string => {
		const parsed = __internal_phext.parse_universe_address(address);
		if (parsed === null) { return ""; }
		const [universe, coord] = parsed;
		const member = this.members[universe - 1];
		if (member === undefined) { return ""; }
		return __internal_phext.fetch(member, coord);
	};
	// resolves a point address against this chain: [universe,
	// coordinate, character offset within the scroll] — the counterpart
	// of libphext-rs Chain::resolve_point's (usize, Coordinate, usize)
	// tuple. A point without "@" resolves to offset 0 of its scroll.
	// Null when the universe or scroll is absent or the position is out
	// of range — never clamps.
	resolve_point = (point: PointAddress): [number, Coordinate, number] | null => {
		if (point.universe < 1 || point.universe > this.members.length) { return null; }
		const text = __internal_phext.addressed_scroll_text(this.members[point.universe - 1], point.coordinate);
		if (text === null) { return null; }
		var offset = 0;
		if (point.position !== null) {
			const resolved = resolve_scroll_offset(text, point.position);
			if (resolved === null) { return null; }
			offset = resolved;
		}
		return [point.universe, point.coordinate, offset];
	};

	// fetches a point address string. A bare point is a caret: it
	// fetches the empty string. The offset form fetches the selected
	// characters: from the point, forward `offset` characters (scalars)
	// within the scroll, terminating at the scroll boundary. Any parse
	// or resolution failure fetches the empty string, as fetch does.
	fetch_point = (address: string): string => {
		const point = __internal_phext.parse_point_address(address);
		if (point === null) { return ""; }
		if (point.offset === null) { return ""; }
		const resolved = this.resolve_point(point);
		if (resolved === null) { return ""; }
		const text = __internal_phext.addressed_scroll_text(this.members[point.universe - 1], point.coordinate);
		if (text === null) { return ""; }
		return Array.from(text).slice(resolved[2], resolved[2] + point.offset).join('');
	};

	// resolves a range against this chain into per-scroll segments:
	// [universe, coordinate, segment text] in ascending order. Middle
	// scrolls contribute their whole text; the endpoint scrolls
	// contribute from/to their endpoint boundaries (an endpoint without
	// "@" contributes its whole scroll). Null when either endpoint fails
	// to resolve — an out-of-range endpoint is an error, never a clamp.
	resolve_range = (range: RangeAddress): Array<[number, Coordinate, string]> | null => {
		const start = range.start;
		const end = range.end;
		if (start.universe < 1 || end.universe > this.members.length || start.universe > end.universe) { return null; }
		// both endpoint scrolls must be present, and both endpoint
		// positions must resolve
		if (this.resolve_point({ universe: start.universe, coordinate: start.coordinate, position: start.position, offset: null }) === null) { return null; }
		if (this.resolve_point({ universe: end.universe, coordinate: end.coordinate, position: end.position, offset: null }) === null) { return null; }
		const segments: Array<[number, Coordinate, string]> = [];
		for (var universe = start.universe; universe <= end.universe; ++universe) {
			const member = this.members[universe - 1];
			const scrolls = __internal_phext.phokenize_bytes(Buffer.from(member, 'utf-8'));
			scrolls.sort((a, b) => {
				if (a.coord.less_than(b.coord)) { return -1; }
				if (a.coord.greater_than(b.coord)) { return 1; }
				return 0;
			});
			for (const s of scrolls) {
				const coord = s.coord;
				if (universe == start.universe && coord.less_than(start.coordinate)) { continue; }
				if (universe == end.universe && coord.greater_than(end.coordinate)) { continue; }
				const scroll_text = s.bytes.toString('utf-8');
				const chars = Array.from(scroll_text);
				var lo = 0;
				var hi = chars.length;
				if (universe == start.universe && coord.equals(start.coordinate)) {
					if (start.position !== null) {
						const r = resolve_scroll_offset(scroll_text, start.position);
						if (r === null) { return null; }
						lo = r;
					}
				}
				if (universe == end.universe && coord.equals(end.coordinate)) {
					if (end.position !== null) {
						const r = resolve_scroll_offset(scroll_text, end.position);
						if (r === null) { return null; }
						hi = r;
					} else {
						hi = chars.length;
					}
				}
				if (lo > hi) { return null; }
				segments.push([universe, coord, chars.slice(lo, hi).join('')]);
			}
		}
		return segments;
	};

	// fetches a range address string: the spanned text with phext
	// structure bytes preserved — the covered segments re-assembled at
	// their coordinates into a phext (chain) fragment (scroll breaks
	// between covered scrolls inside a universe, CHAIN_BREAK between
	// universes, never a trailing CHAIN_CLOSE: a fragment is an
	// excerpt, not a terminated chain), so the result round-trips as a
	// phext fragment. Empty segments contribute nothing. Any parse or
	// resolution failure fetches the empty string, as fetch does.
	fetch_range = (address: string): string => {
		const range = __internal_phext.parse_range_address(address);
		if (range === null) { return ""; }
		const segments = this.resolve_range(range);
		if (segments === null) { return ""; }
		const members: Array<string> = [];
		for (var universe = range.start.universe; universe <= range.end.universe; ++universe) {
			var member = "";
			for (const seg of segments) {
				if (seg[0] != universe) { continue; }
				if (seg[2].length > 0) {
					member = __internal_phext.insert(member, seg[1], seg[2]);
				}
			}
			members.push(member);
		}
		return new Chain(members, false).serialize();
	};

}

// A caret boundary inside one scroll (0.6.1): 1-based line and column.
// Column 1 is the boundary before the line's first character; a line of
// n characters has valid columns 1..n+1. Columns count Unicode scalar
// values.
export interface ScrollPosition {
	line: number;
	column: number;
}

// One parsed point address (0.6.1): universe (1-based; 1 when the "$N:"
// prefix is absent), the 9D coordinate, an optional caret position, and
// an optional forward offset in characters (Unicode scalar values).
export interface PointAddress {
	universe: number;
	coordinate: Coordinate;
	position: ScrollPosition | null;
	offset: number | null;
}

// A parsed range (0.6.1): two point endpoints, normalized to ascending
// order at parse time (direction is discarded).
export interface RangeAddress {
	start: PointAddress;
	end: PointAddress;
}

// An unsigned decimal integer in the address language: ASCII digits
// only, at least one, no sign, ever. Leading zeros parse by value.
// Returns null for anything else — including values a JS number cannot
// represent exactly: libphext-rs parses into usize, and an integer past
// Number.MAX_SAFE_INTEGER cannot be held exactly here, so it is
// rejected rather than silently rounded.
function parse_address_uint(text: string): number | null {
	if (text.length == 0 || !/^[0-9]+$/.test(text)) { return null; }
	const value = Number(text);
	if (!Number.isSafeInteger(value)) { return null; }
	return value;
}

// A 9D coordinate in the address language: three arms of three
// dot-separated unsigned integers, every component >= 1. Returns null
// on any other shape. (The Coordinate constructor sanitizes stray
// values toward 1, so the address grammar validates strictly here
// first, then builds the Coordinate from the canonical string.)
function parse_address_coordinate(text: string): Coordinate | null {
	const arms = text.split('/');
	if (arms.length != 3) { return null; }
	const values: Array<number> = [];
	for (const arm of arms) {
		const parts = arm.split('.');
		if (parts.length != 3) { return null; }
		for (const part of parts) {
			const value = parse_address_uint(part);
			if (value === null || value < 1) { return null; }
			values.push(value);
		}
	}
	const canonical = `${values[0]}.${values[1]}.${values[2]}/${values[3]}.${values[4]}.${values[5]}/${values[6]}.${values[7]}.${values[8]}`;
	return new Coordinate(canonical);
}

// The sort key of a range endpoint: its position when it carries one;
// an endpoint without "@" sorts by role — as start, its scroll's first
// boundary (1, 1); as end, its scroll's last boundary (past every real
// position).
function endpoint_position_key(point: PointAddress, is_start: boolean): [number, number] {
	if (point.position !== null) { return [point.position.line, point.position.column]; }
	return is_start ? [1, 1] : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
}

// Total order on range endpoints: (universe, coordinate, line, column),
// with a missing "@" read by role (see endpoint_position_key). Returns
// a negative number, 0, or a positive number, comparator-style.
function endpoint_cmp(a: PointAddress, a_is_start: boolean, b: PointAddress, b_is_start: boolean): number {
	if (a.universe != b.universe) { return a.universe < b.universe ? -1 : 1; }
	if (a.coordinate.less_than(b.coordinate)) { return -1; }
	if (a.coordinate.greater_than(b.coordinate)) { return 1; }
	const ka = endpoint_position_key(a, a_is_start);
	const kb = endpoint_position_key(b, b_is_start);
	if (ka[0] != kb[0]) { return ka[0] < kb[0] ? -1 : 1; }
	if (ka[1] != kb[1]) { return ka[1] < kb[1] ? -1 : 1; }
	return 0;
}

// Resolves a caret position inside one scroll to a character (scalar)
// offset. Null when the line or column is past the scroll's extent —
// never clamps. The walk iterates code points (for..of over the
// string), so columns and offsets count Unicode scalar values, never
// UTF-16 code units or bytes.
function resolve_scroll_offset(text: string, pos: ScrollPosition): number | null {
	if (pos.line < 1 || pos.column < 1) { return null; }
	var line = 1;
	var column = 1;
	var offset = 0;
	for (const ch of text) {
		if (line == pos.line && column == pos.column) { return offset; }
		if (ch == '\n') { line += 1; column = 1; } else { column += 1; }
		offset += 1;
	}
	if (line == pos.line && column == pos.column) { return offset; }
	return null;
}


// Header line plus its terminating line break: the prefix of every binary
// scroll.
const BINARY_SCROLL_PREFIX = BINARY_SCROLL_HEADER + "\n";

// liblzma's CHECK_CRC64 constant (lzma_check enum: NONE=0, CRC32=1,
// CRC64=4, SHA256=10 — stable liblzma ABI values). The numeric value is
// used directly because lzma-native assigns its CHECK_* constants
// dynamically from the native binding, and Node's ESM namespace import
// of the package therefore does not expose them (lzma.CHECK_CRC64 is
// undefined under `import * as lzma from 'lzma-native'`, and passing
// check: undefined silently seals with the binding's CRC32 default —
// a different, shorter stream than libphext-rs produces).
const LZMA_CHECK_CRC64 = 4;

// Strict RFC 4648 base64 decode (standard alphabet, padding required, no
// whitespace, canonical pad bits) — the semantics of the Rust base64
// crate's STANDARD engine. Node's Buffer base64 decoder is lenient (it
// skips characters outside the alphabet), so the shape is validated
// first; returns null for anything that is not strict base64.
function strict_base64_decode(body: string): Buffer | null {
	if (body.length % 4 != 0) { return null; }
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body)) { return null; }
	// canonical pad bits: the unused low bits of the final data character
	// must be zero (the Rust STANDARD engine rejects non-zero pad bits)
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	if (body.endsWith("==")) {
		if (body.length < 4) { return null; }
		if ((alphabet.indexOf(body[body.length - 3]) & 0x0F) != 0) { return null; }
	} else if (body.endsWith("=")) {
		if (body.length < 4) { return null; }
		if ((alphabet.indexOf(body[body.length - 2]) & 0x03) != 0) { return null; }
	}
	return Buffer.from(body, 'base64');
}

// Decodes bytes as UTF-8, strictly: returns the string, or null when the
// bytes are not valid UTF-8 (the JS counterpart of Rust's
// String::from_utf8 succeeding or failing). TextDecoder with fatal:true
// rejects exactly the byte sequences Rust rejects (overlong forms,
// surrogate halves, values past U+10FFFF).
const __utf8_decoder = new TextDecoder('utf-8', { fatal: true });
function try_utf8_decode(data: Buffer | Uint8Array): string | null {
	try {
		return __utf8_decoder.decode(data);
	} catch (e) {
		return null;
	}
}

// The stored form of an incoming scroll update, per the ingestion rule:
// valid UTF-8 stays text; anything else becomes a binary scroll holding
// the base64 of the exact observed bytes, verbatim.
function stored_form(phext: Phext, payload: Buffer | Uint8Array): string {
	const text = try_utf8_decode(payload);
	return text !== null ? text : phext.encode_scroll(payload);
}

// The nine dimension-break bytes (the byte twins of the Phext constants).
function is_structural_break(byte: number): boolean {
	return byte == 0x17 || // SCROLL_BREAK
	       byte == 0x18 || // SECTION_BREAK
	       byte == 0x19 || // CHAPTER_BREAK
	       byte == 0x1A || // BOOK_BREAK
	       byte == 0x1C || // VOLUME_BREAK
	       byte == 0x1D || // COLLECTION_BREAK
	       byte == 0x1E || // SERIES_BREAK
	       byte == 0x1F || // SHELF_BREAK
	       byte == 0x01;   // LIBRARY_BREAK
}

function apply_break(coord: Coordinate, byte: number): void {
	if (byte == 0x17) { coord.scroll_break(); }
	if (byte == 0x18) { coord.section_break(); }
	if (byte == 0x19) { coord.chapter_break(); }
	if (byte == 0x1A) { coord.book_break(); }
	if (byte == 0x1C) { coord.volume_break(); }
	if (byte == 0x1D) { coord.collection_break(); }
	if (byte == 0x1E) { coord.series_break(); }
	if (byte == 0x1F) { coord.shelf_break(); }
	if (byte == 0x01) { coord.library_break(); }
}

// A Coordinate is nine unbounded components (each >= 1): library.shelf.series /
// collection.volume.book / chapter.section.scroll. Since 0.4.0 the format has no
// upper limit; the only bound is MAX_COMPONENT (Number.MAX_SAFE_INTEGER), the
// largest integer a JS number represents exactly — exceeding it is an error,
// never a silent rounding.
//
// Dense graphs: phext is sparse by design. Coordinate components are unbounded,
// but a fully-populated dense graph contains the product of its dimensions'
// extents in scrolls — a dense block spanning 1000 in each of 9 dimensions
// implies 10^27 scrolls. Materializing, exploding, or indexing such a graph
// costs memory proportional to its populated scroll count. The old 999 cap
// never protected against this (999^9 was already unreachable); sparsity does.
// Keep graphs sparse.
export class Coordinate {
	z: ZCoordinate;
	y: YCoordinate;
	x: XCoordinate;
	constructor(value: string = "") {
		this.z = new ZCoordinate(1,1,1);
		this.y = new YCoordinate(1,1,1);
		this.x = new XCoordinate(1,1,1);
		if (value.length > 0) {
			var parts = value.replace(/\//g, '.').split('.');
			var fields = [
				(n: number) => { this.z.library = n; },
				(n: number) => { this.z.shelf = n; },
				(n: number) => { this.z.series = n; },
				(n: number) => { this.y.collection = n; },
				(n: number) => { this.y.volume = n; },
				(n: number) => { this.y.book = n; },
				(n: number) => { this.x.chapter = n; },
				(n: number) => { this.x.section = n; },
				(n: number) => { this.x.scroll = n; },
			];
			for (var i = 0; i < parts.length && i < fields.length; ++i) {
				fields[i](sanitize_component(parseInt(parts[i])));
			}
		}
	}

	equals = (other: Coordinate): boolean => {
		return this.z.library == other.z.library &&
		       this.z.shelf == other.z.shelf &&
			   this.z.series == other.z.series &&
			   this.y.collection == other.y.collection &&
			   this.y.volume == other.y.volume &&
			   this.y.book == other.y.book &&
			   this.x.chapter == other.x.chapter &&
			   this.x.section == other.x.section &&
			   this.x.scroll == other.x.scroll;
	};

	less_than = (other: Coordinate): boolean => {
		if (this.z.library < other.z.library) { return true; }
		if (this.z.library > other.z.library) { return false; }
		if (this.z.shelf < other.z.shelf) { return true; }
		if (this.z.shelf > other.z.shelf) { return false; }
		if (this.z.series < other.z.series) { return true; }
		if (this.z.series > other.z.series) { return false; }
		if (this.y.collection < other.y.collection) { return true; }
		if (this.y.collection > other.y.collection) { return false; }
		if (this.y.volume < other.y.volume) { return true; }
		if (this.y.volume > other.y.volume) { return false; }
		if (this.y.book < other.y.book) { return true; }
		if (this.y.book > other.y.book) { return false; }
		if (this.x.chapter < other.x.chapter) { return true; }
		if (this.x.chapter > other.x.chapter) { return false; }
		if (this.x.section < other.x.section) { return true; }
		if (this.x.section > other.x.section) { return false; }
		if (this.x.scroll < other.x.scroll) { return true; }
		return false;
	};

	greater_than = (other: Coordinate): boolean => {
		if (this.z.library > other.z.library) { return true; }
		if (this.z.library < other.z.library) { return false; }
		if (this.z.shelf > other.z.shelf) { return true; }
		if (this.z.shelf < other.z.shelf) { return false; }
		if (this.z.series > other.z.series) { return true; }
		if (this.z.series < other.z.series) { return false; }
		if (this.y.collection > other.y.collection) { return true; }
		if (this.y.collection < other.y.collection) { return false; }
		if (this.y.volume > other.y.volume) { return true; }
		if (this.y.volume < other.y.volume) { return false; }
		if (this.y.book > other.y.book) { return true; }
		if (this.y.book < other.y.book) { return false; }
		if (this.x.chapter > other.x.chapter) { return true; }
		if (this.x.chapter < other.x.chapter) { return false; }
		if (this.x.section > other.x.section) { return true; }
		if (this.x.section < other.x.section) { return false; }
		if (this.x.scroll > other.x.scroll) { return true; }
		return false;
	};

	advance_to = (other: Coordinate): string => {
		var output = "";
		while (this.less_than(other)) {
			if (this.z.library < other.z.library)       { output += __internal_phext.LIBRARY_BREAK;    this.library_break();    continue; }
			if (this.z.shelf < other.z.shelf)           { output += __internal_phext.SHELF_BREAK;      this.shelf_break();      continue; }
			if (this.z.series < other.z.series)         { output += __internal_phext.SERIES_BREAK;     this.series_break();     continue; }
			if (this.y.collection < other.y.collection) { output += __internal_phext.COLLECTION_BREAK; this.collection_break(); continue; }
			if (this.y.volume < other.y.volume)         { output += __internal_phext.VOLUME_BREAK;     this.volume_break();     continue; }
			if (this.y.book < other.y.book)             { output += __internal_phext.BOOK_BREAK;       this.book_break();       continue; }
			if (this.x.chapter < other.x.chapter)       { output += __internal_phext.CHAPTER_BREAK;    this.chapter_break();    continue; }
			if (this.x.section < other.x.section)       { output += __internal_phext.SECTION_BREAK;    this.section_break();    continue; }
			if (this.x.scroll < other.x.scroll)         { output += __internal_phext.SCROLL_BREAK;     this.scroll_break();     continue; }
		}
		return output;
	};

	validate_index = (index: number): boolean => {
		return index >= __internal_phext.COORDINATE_MINIMUM;
  	};

	validate_coordinate = (): boolean => {
		let ok = this.validate_index(this.z.library) &&
				 this.validate_index(this.z.shelf) &&
			     this.validate_index(this.z.series) &&
			     this.validate_index(this.y.collection) &&
			     this.validate_index(this.y.volume) &&
			     this.validate_index(this.y.book) &&
			     this.validate_index(this.x.chapter) &&
			     this.validate_index(this.x.section) &&
			     this.validate_index(this.x.scroll);
		return ok;
	};

	to_string = (): string => {
		return `${this.z.library}.${this.z.shelf}.${this.z.series}/${this.y.collection}.${this.y.volume}.${this.y.book}/${this.x.chapter}.${this.x.section}.${this.x.scroll}`;
	};

	to_urlencoded = (): string => {
		return this.to_string().replace(/\//g, ';');
	}

	advance_coordinate = (index: number): number => {
		if (Number.isNaN(index)) { return __internal_phext.COORDINATE_MINIMUM; }
		return sanitize_component(index + 1);
	};

	library_break = (): void => {
		this.z.library = this.advance_coordinate(this.z.library);
		this.z.shelf = 1;
		this.z.series = 1;
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	shelf_break = (): void => {
		this.z.shelf = this.advance_coordinate(this.z.shelf);
		this.z.series = 1;
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	series_break = (): void => {
		this.z.series = this.advance_coordinate(this.z.series);
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	collection_break = (): void => {
		this.y.collection = this.advance_coordinate(this.y.collection);
		this.y.volume = 1;
		this.y.book = 1;
		this.x = new XCoordinate();
	};
	volume_break = (): void => {
		this.y.volume = this.advance_coordinate(this.y.volume);
		this.y.book = 1;
		this.x = new XCoordinate();
	};
	book_break = (): void => {
		this.y.book = this.advance_coordinate(this.y.book);
		this.x = new XCoordinate();
	};
	chapter_break = (): void => {
		this.x.chapter = this.advance_coordinate(this.x.chapter);
		this.x.section = 1;
		this.x.scroll = 1;
	};
	section_break = (): void => {
		this.x.section = this.advance_coordinate(this.x.section);
		this.x.scroll = 1;
	};
	scroll_break = (): void => {
		this.x.scroll = this.advance_coordinate(this.x.scroll);
	};
}

// UTF-8 byte length of a string — the unit libphext-rs measures scroll
// offsets in (Rust str::len is a byte count). JS string length counts UTF-16
// code units and silently undercounts every non-ASCII scroll, so index/offset
// measure with this instead. Audit note: the only other length arithmetic in
// this file feeds substring() slicing (get_subspace_coordinates, fetch,
// insert, range_replace), where UTF-16 indices are internally consistent and
// the strings produced are identical to rs; offset() is the sole place a
// numeric offset escapes the library, through index_phokens.
const __utf8_encoder = new TextEncoder();
function utf8_length(text: string): number {
	return __utf8_encoder.encode(text).length;
}

// Sanitize a computed coordinate component (Will's rules, 2026-11-02): no
// phext coordinate component can ever be less than 1 — coordinates are 1-based
// by definition — and a phext address never carries NaN. A NaN component (from
// non-numeric input, an empty segment, or a poisoned advance) wraps to
// COORDINATE_MINIMUM (1), as does 0 and any other value below the minimum.
// EVERY path that produces a component funnels through here: the Coordinate
// constructor, Phext.to_coordinate, the advance paths, and the X/Y/Z sub-
// coordinate constructors. There is no "null coordinate": until Will's
// floor ruling, to_coordinate preserved explicit 0 components (mirroring rs);
// that exception is removed — 0 wraps to 1 exactly like NaN.
function sanitize_component(value: number): number {
	if (Number.isNaN(value)) { return __internal_phext.COORDINATE_MINIMUM; }
	if (value > MAX_COMPONENT) {
		throw new Error(`libphext: coordinate component ${value} exceeds MAX_COMPONENT (${MAX_COMPONENT}) — a JS number cannot represent it exactly`);
	}
	if (value < __internal_phext.COORDINATE_MINIMUM) { return __internal_phext.COORDINATE_MINIMUM; }
	return value;
}

// internal static data
var __internal_phext = new Phext(); // for constants

// internal classes

class OffsetsAndCoordinate {
	start: number;
	end: number;
	coord: Coordinate;
	fallback: Coordinate;
	constructor(start: number, end: number, coord: Coordinate, fallback: Coordinate) {
		this.start = start;
		this.end = end;
		this.coord = coord;
		this.fallback = fallback;
	}
}

class PositionedScroll {
	coord: Coordinate;
	scroll: string;
	next: Coordinate;
	remaining: string;
	constructor(coord: Coordinate, scroll: string, next: Coordinate, remaining: string) {
		this.coord = coord;
		this.scroll = scroll;
		this.next = next;
		this.remaining = remaining;
	}
}

class Range {
	start: Coordinate;
	end: Coordinate;
	constructor(start: Coordinate, end: Coordinate) {
		this.start = start;
		this.end = end;
	}
}

class ZCoordinate {
	library: number;
	shelf: number;
	series: number;
	constructor(library: number = 1, shelf: number = 1, series: number = 1) {
		this.library = sanitize_component(library);
		this.shelf = sanitize_component(shelf);
		this.series = sanitize_component(series);
	}
}

class YCoordinate {
	collection: number;
	volume: number;
	book: number;
	constructor(collection: number = 1, volume: number = 1, book: number = 1) {
		this.collection = sanitize_component(collection);
		this.volume = sanitize_component(volume);
		this.book = sanitize_component(book);
	}
}

class XCoordinate {
	chapter: number;
	section: number;
	scroll: number;
	constructor(chapter: number = 1, section: number = 1, scroll: number = 1) {
		this.chapter = sanitize_component(chapter);
		this.section = sanitize_component(section);
		this.scroll = sanitize_component(scroll);
	}
}