// -----
// Phext
// -----
// (c) 2024 Phext, Inc.
// Licensed under the MIT License
//
// This project was ported from https://github.com/wbic16/libphext-rs/blob/master/src/phext.rs.
// Web Site: https://phext.io/
// -----------------------------------------------------------------------------------------------------------
// `buffer` is Node's own module under Node and the `buffer` package in browser bundles.
import { Buffer } from 'buffer';
import { XXH3_128 } from 'xxh3-ts/xxh3.js';

// A line break or any of the nine dimension breaks.
const PHEXT_BREAK = /[\n\x01\x17-\x1A\x1C-\x1F]/;

export class Phext {
	COORDINATE_MINIMUM: number;
	COORDINATE_MAXIMUM: number;
	LIBRARY_BREAK: string;
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
		this.COORDINATE_MAXIMUM = 1000;
        this.LIBRARY_BREAK       = '\x01'; // 11D Break - replaces start of header
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

	// Finds where the scroll at `target` sits, matching libphext-rs:
	// - when the document reaches `target`, start..end is that scroll's text (empty if it has none) and
	//   coord is `target`;
	// - otherwise start == end is where the scroll would go: just before the break that steps past
	//   `target`, or the end of the document. coord is the coordinate in effect there, so writing breaks
	//   from coord up to `target` and then the text places it correctly.
	// The walker only moves on a dimension break, so it is compared with `target` only at the start and
	// after each break, and the scan stops as soon as it steps past `target`. Earlier versions left end at
	// 0 when the target scroll was followed by a break at the very end of the document, so fetch returned
	// "" and insert wrote at the start.
	get_subspace_coordinates = (subspace: string, target: Coordinate): OffsetsAndCoordinate => {
		const walker = new Coordinate();
		var best = new Coordinate();
		var found = -1;
		const max = subspace.length;
		var position = 0;
		var moved = true;

		for (;;) {
			// `walker` is the coordinate in effect at `position`
			if (moved && found < 0) {
				if (walker.equals(target)) {
					found = position;
					best = this.to_coordinate(walker.to_string());
				} else if (walker.less_than(target)) {
					best = this.to_coordinate(walker.to_string());
				} else {
					// before the first scroll: `target` sorts ahead of 1.1.1/1.1.1/1.1.1
					return new OffsetsAndCoordinate(position, position, best, best);
				}
				moved = false;
			}
			if (position == max) {
				break;
			}

			if (apply_break(walker, subspace.charCodeAt(position))) {
				moved = true;
				if (walker.greater_than(target)) {
					return found >= 0
						? new OffsetsAndCoordinate(found, position, best, best)
						: new OffsetsAndCoordinate(position, position, best, best);
				}
				// a break that cannot advance a dimension already at 999 leaves the walker on `target`:
				// the scroll's text starts after it
				if (found == position) {
					found = position + 1;
				}
			}
			++position;
		}

		return found >= 0
			? new OffsetsAndCoordinate(found, max, best, best)
			: new OffsetsAndCoordinate(max, max, best, best);
	};

	remove = (phext: string, location: Coordinate): string => {
		var phase1 = this.replace(phext, location, "");
  		return this.normalize(phase1);
	};

	// The text up to the first line or dimension break, with "..." when anything follows, as in
	// libphext-rs 0.3.x: no 32-character limit, and "" for an empty buffer.
	create_summary = (phext: string): string => {
		const stop = phext.search(PHEXT_BREAK);
		if (stop < 0) {
			return phext;
		}
		return phext.substring(0, stop) + "...";
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

	// xxh3-128 of the UTF-8 bytes, as 32 hex digits: the same value libphext-rs and libphext-py return.
	// xxh3-ts 2.x implements xxHash 0.8 and is plain TypeScript, so it also works in browser bundles.
	checksum = (phext: string): string => {
		const hash = XXH3_128(Buffer.from(phext, 'utf8'));
		return hash.toString(16).padStart(32, '0');
	};

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
		  offset += delims.length;
		  const new_coord = new Coordinate(coord.to_string());
		  output.push(new PositionedScroll(new_coord, `${offset}`, new_coord, ""));
		  offset += phokens[i].scroll.length;
		}

		return output;
	};

	index = (phext: string): string => {
		var output = this.index_phokens(phext);
		return this.dephokenize(output);
	};

	// The offset of the scroll at `coord`, or of the last scroll before it; 0 when no scroll comes at or
	// before `coord` (this used to return NaN).
	offset = (phext: string, coord: Coordinate): number => {
		const output = this.index_phokens(phext);
		var result = 0;
		for (var i = 0; i < output.length; ++i) {
			if (output[i].coord.greater_than(coord)) {
				break;
			}
			result = parseInt(output[i].scroll);
		}
		return result;
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
		const step = scan_scroll(phext, 0, start);
		const output = step.first >= 0 ? phext.substring(step.first, step.end) : "";
		const remaining = step.next < phext.length ? phext.substring(step.next) : "";
		return new PositionedScroll(step.begin ?? start, output, start, remaining);
	};

	// One pass over the document: each step is exactly one next_scroll call, but it works on offsets
	// into `phext` instead of a fresh copy of the remainder. Earlier versions also built each scroll one
	// code unit at a time and copied the coordinate (via to_string) for every code unit, which made
	// explode cost ~1.5 us per code unit; scrolls are now taken with a single substring each.
	// As before, every token's `next` is the one shared walker, and `remaining` is the text after it.
	phokenize = (phext: string): Array<PositionedScroll> => {
		var result = Array();
		const coord = new Coordinate();
		const max = phext.length;
		var pi = 0;
		while (true) {
			const step = scan_scroll(phext, pi, coord);
			if (step.first < 0) {
				break;
			}
			const remaining = step.next < max ? phext.substring(step.next) : "";
			result.push(new PositionedScroll(step.begin!, phext.substring(step.first, step.end), coord, remaining));
			pi = step.next;
			if (pi >= max) {
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
		// Keeps the left-hand scrolls whose coordinate has no content on the right. Earlier versions never
		// moved past right-hand scrolls that sort before the current left one, so later scrolls were lost.
  		for (var i = 0; i < pl.length; ++i) {
			const token = pl[i];
			if (token.scroll.length == 0) {
				continue;
			}
			while (pri < max && pr[pri].coord.less_than(token.coord)) {
				++pri;
			}
			const masked = pri < max && pr[pri].coord.equals(token.coord) && pr[pri].scroll.length > 0;
			if (!masked) {
				result += this.append_scroll(token, coord);
			}
  		}

  		return result;
	};

	// Explodes a phext into a map from coordinate address ("1.1.1/1.1.1/1.1.1") to scroll text, like
	// libphext-rs `explode`. Keys are address strings because a Map keyed by Coordinate objects would
	// compare them by identity.
	explode = (phext: string): Map<string, string> => {
		const map = new Map<string, string>();
		const phokens = this.phokenize(phext);
		for (var i = 0; i < phokens.length; ++i) {
			map.set(phokens[i].coord.to_string(), phokens[i].scroll);
		}
		return map;
	};

	// Serializes a map from coordinate address to scroll text (a Map, or a plain object) back into a phext
	// document, like libphext-rs `implode`. Empty scrolls are left out.
	implode = (map: Map<string, string> | Record<string, string>): string => {
		const entries = map instanceof Map ? Array.from(map.entries()) : Object.entries(map);
		const phokens = entries.map(([address, scroll]) => this.create_positioned_scroll(this.to_coordinate(address), scroll));
		phokens.sort((a, b) => a.coord.less_than(b.coord) ? -1 : (b.coord.less_than(a.coord) ? 1 : 0));
		return this.dephokenize(phokens);
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
				  case 1: result.z.library = value; index += 1; break;
				  case 2: result.z.shelf = value; index += 1; break;
				  case 3: result.z.series = value; index += 1; break;
				  case 4: result.y.collection = value; index += 1; break;
				  case 5: result.y.volume = value; index += 1; break;
				  case 6: result.y.book = value; index += 1; break;
				  case 7: result.x.chapter = value; index += 1; break;
				  case 8: result.x.section = value; index += 1; break;
				}
				value = 0;
			}

			if (byte >= '0' && byte <= '9')
			{
				value = exp * value + parseInt(byte);
				if (index == 0) { index = 1; }
			}
		}

  		if (index > 0) {
    		result.x.scroll = value;
  		}

  		return result;
	};
}

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
			if (parts.length >= 1) { this.z.library = parseInt(parts[0]); if (this.z.library < 1) { this.z.library = 1; }}
			if (parts.length >= 2) { this.z.shelf = parseInt(parts[1]); if (this.z.shelf < 1) { this.z.shelf = 1; }}
			if (parts.length >= 3) { this.z.series = parseInt(parts[2]); if (this.z.series < 1) { this.z.series = 1; }}
			if (parts.length >= 4) { this.y.collection = parseInt(parts[3]); if (this.y.collection < 1) { this.y.collection = 1; }}
			if (parts.length >= 5) { this.y.volume = parseInt(parts[4]); if (this.y.volume < 1) { this.y.volume = 1; }}
			if (parts.length >= 6) { this.y.book = parseInt(parts[5]); if (this.y.book < 1) { this.y.book = 1; }}
			if (parts.length >= 7) { this.x.chapter = parseInt(parts[6]); if (this.x.chapter < 1) { this.x.chapter = 1; }}
			if (parts.length >= 8) { this.x.section = parseInt(parts[7]); if (this.x.section < 1) { this.x.section = 1; }}
			if (parts.length >= 9) { this.x.scroll = parseInt(parts[8]); if (this.x.scroll < 1) { this.x.scroll = 1; }}
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
		return index >= __internal_phext.COORDINATE_MINIMUM && index <= __internal_phext.COORDINATE_MAXIMUM;
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
		var next = index + 1;
		if (next < __internal_phext.COORDINATE_MAXIMUM) {
			return next;
		}

		return index;
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

// internal static data
var __internal_phext = new Phext(); // for constants

// Advances `coord` past the dimension break whose UTF-16 code unit is `code`. Returns false, leaving
// `coord` untouched, for anything else (including LINE_BREAK, which is not a dimension break).
function apply_break(coord: Coordinate, code: number): boolean {
	switch (code) {
		case 0x17: coord.scroll_break();     return true; // SCROLL_BREAK
		case 0x18: coord.section_break();    return true; // SECTION_BREAK
		case 0x19: coord.chapter_break();    return true; // CHAPTER_BREAK
		case 0x1A: coord.book_break();       return true; // BOOK_BREAK
		case 0x1C: coord.volume_break();     return true; // VOLUME_BREAK
		case 0x1D: coord.collection_break(); return true; // COLLECTION_BREAK
		case 0x1E: coord.series_break();     return true; // SERIES_BREAK
		case 0x1F: coord.shelf_break();      return true; // SHELF_BREAK
		case 0x01: coord.library_break();    return true; // LIBRARY_BREAK
	}
	return false;
}

// One next_scroll step starting at code unit `pi`, advancing `location` in place: skip leading breaks,
// take the run of text, then consume the break that ends it. Breaks are single BMP code units, so the
// offsets never split a surrogate pair. `first` is -1 when no text was found before the end.
function scan_scroll(phext: string, pi: number, location: Coordinate): ScrollStep {
	const max = phext.length;
	var first = -1;
	var end = max;
	var begin: Coordinate | null = null;
	while (pi < max) {
		if (apply_break(location, phext.charCodeAt(pi))) {
			if (first >= 0) {
				end = pi;
				pi += 1;
				break;
			}
		} else if (first < 0) {
			first = pi;
			begin = new Coordinate(location.to_string());
		}
		++pi;
	}
	return { begin, first, end, next: pi };
}

interface ScrollStep {
	begin: Coordinate | null; // copy of the coordinate the text sits at (null if there was no text)
	first: number;            // offset of the first code unit of text, or -1
	end: number;              // offset one past the last code unit of text
	next: number;             // offset where the following step starts
}

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
		this.library = library;
		this.shelf = shelf;
		this.series = series;
	}
}

class YCoordinate {
	collection: number;
	volume: number;
	book: number;
	constructor(collection: number = 1, volume: number = 1, book: number = 1) {
		this.collection = collection;
		this.volume = volume;
		this.book = book;
	}
}

class XCoordinate {
	chapter: number;
	section: number;
	scroll: number;
	constructor(chapter: number = 1, section: number = 1, scroll: number = 1) {
		this.chapter = chapter;
		this.section = section;
		this.scroll = scroll;
	}
}