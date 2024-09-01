// -----
// Phext
// -----
// (c) 2024 Phext, Inc.
// Licensed under the MIT License
//
// This project was ported from https://github.com/wbic16/libphext-rs/blob/master/src/phext.rs.
// Web Site: https://phext.io/
// -----------------------------------------------------------------------------------------------------------
export class Phext {
	constructor(subspace) {
		this.subspace = subspace;
		this.state = 'unparsed';
		this.COORDINATE_MINIMUM = 1;
		this.COORDINATE_MAXIMUM = 100;
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
	
	status = () => {
		console.log(`Length: ${this.subspace.length}`);
		console.log(`state: ${this.state}`);
	};

	create_range(start, end) {
		return new Range(start, end);
	}

	check_for_cowbell(phext) {
		for (var i = 0; i < phext.length; ++i) {
			if (phext[i] == this.MORE_COWBELL) {
				return true;
			}
		}
	
	  	return false;
	};

	get_subspace_coordinates = (subspace, target) => {
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
			//console.log(`end2: ${end} => ${max} (${insertion.to_string()})`);
			end = max;
			insertion = walker;
    		stage = 2;
  		}

  		if (stage == 0) {
    		start = max;
			//console.log(`end3: ${end} => ${max} (${insertion.to_string()})`);
    		end = max;
			insertion = walker;
  		}

		var result = new OffsetsAndCoordinate(start, end, insertion, fallback);
		return result;
	};

	remove = (phext, location) => {
		var phase1 = this.replace(phext, location, "");
  		return this.normalize(phase1);
	};

	create_summary = (phext) => {
		// stub - see lines 382-402 in phext.rs
		return '';
	};

	navmap = (urlbase, phext) => {
		// stub - see lines 407-420 in phext.rs
		return '';
	};

	textmap = (phext) => {
		var phokens = this.phokenize(phext);
  		var result = '';
  		for (var i = 0; i < phokens.length; ++i) {
			var phoken = phokens[i];
    		result += `* ${phoken.coord}: ${this.create_summary(phoken.scroll)}\n`;
  		}

  		return result;
	};

	checksum = (phext) => {
		var hash = todo_xxh3_128(phext);
		return hash;
	};

	manifest = (phext) => {
		var phokens = this.phokenize(phext);
		for (var i = 0; i < phokens.length; ++i) {
		  phokens[i].scroll = checksum(phokens[i].scroll);
		  ++i;
		}

		return this.dephokenize(phokens);
	};

	soundex_internal = (buffer) => {
		var letter1 = "bpfv";
		var letter2 = "cskgjqxz";
		var letter3 = "dt";
		var letter4 = "l";
		var letter5 = "mn";
		var letter6 = "r";

		var value = 1; // 1-100
		for (var i = 0; i < buffer.length; ++i) {
		  var c = buffer[i];
		  if (letter1.contains(c)) { value += 1; continue; }
		  if (letter2.contains(c)) { value += 2; continue; }
		  if (letter3.contains(c)) { value += 3; continue; }
		  if (letter4.contains(c)) { value += 4; continue; }
		  if (letter5.contains(c)) { value += 5; continue; }
		  if (letter6.contains(c)) { value += 6; continue; }
		}

		return value % 99;
	};

	soundex_v1 = (phext) => {
		var phokens = this.phokenize(phext);

		for (var i = 0; i < phokens.length; ++i) {
		  phokens[i].scroll = soundex_internal(phokens[i].scroll);
		}

		return this.dephokenize(phokens);
	};

	index_phokens = (phext) => {
		var phokens = this.phokenize(phext);
		var offset = 0;
		var coord = new Coordinate();
		var output = new Array();
		for (var i = 0; i < phokens.length; ++i) {
		  let reference = phokens[i].coord;
		  while (coord.z.library < reference.z.library) { coord.library_break(); offset += 1; }
		  while (coord.z.shelf < reference.z.shelf) { coord.shelf_break(); offset += 1; }
		  while (coord.z.series < reference.z.series) { coord.series_break(); offset += 1; }
		  while (coord.y.collection < reference.y.collection) { coord.collection_break(); offset += 1; }
		  while (coord.y.volume < reference.y.volume) { coord.volume_break(); offset += 1; }
		  while (coord.y.book < reference.y.book) { coord.book_break(); offset += 1; }
		  while (coord.x.chapter < reference.x.chapter) { coord.chapter_break(); offset += 1; }
		  while (coord.x.section < reference.x.section) { coord.section_break(); offset += 1; }
		  while (coord.x.scroll < reference.x.scroll) { coord.scroll_break(); offset += 1; }

		  output[i] = new PositionedScroll(coord, offset);
		  offset += phokens[i].scroll.length;
		  ++i;
		}

		return output;
	};

	index = (phext) => {
		var output = index_phokens(phext);
		return this.dephokenize(output);
	};

	offset = (phext, coord) => {
		var output = index_phokens(phext);

		var best = new Coordinate();
		var matched = false;
		var fetch_coord = coord;
		for (var i = 0; i < output.length; ++i) {
			var phoken = output[i];
		 	if (phoken.coord <= coord) {
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

	replace = (phext, location, scroll) => {
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

	range_replace = (phext, location, scroll) => {
  		var parts_start = this.get_subspace_coordinates(phext, location.start);
  		var parts_end = this.get_subspace_coordinates(phext, location.end);
  		var start = parts_start.start;
  		var end = parts_end.end;
		const max = phext.length;
		if (end > max) { end = max; }
		const left = phext.substr(0, start);
		const right = phext.substr(end);
		const result = left + scroll + right;
		return result;
	};

	insert = (buffer, location, scroll) => {
  		var parts = this.get_subspace_coordinates(buffer, location);
  		const end = parts.end;
  		var fixup = "";
  		var subspace_coordinate = parts.coord;

		fixup += subspace_coordinate.advance_to(location);

  		const left = buffer.substr(0, end);
  		const right = buffer.substr(end);
		//console.log(`end: ${end}, parts: ${parts.coord.to_string()}, subspace: ${subspace_coordinate.to_string()}, location: ${location.to_string()}`);
		const result = left + fixup + scroll + right;
		return result;
	};

	next_scroll = (phext, start) => {
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
			remaining = phext.substr(pi);
		}

  		const out_scroll = new PositionedScroll(begin, output, location, remaining);
  		return out_scroll;
	};

	phokenize = (phext) => {
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

	merge = (left, right) => {
	};

	fetch = (phext, target) => {
  		var parts = this.get_subspace_coordinates(phext, target);
		//console.log(`parts: ${parts.start}, ${parts.end}, ${parts.coord.to_string()}.`);
		//console.log(`phext: ${phext.length}`);
  		var start = parts.start;
  		var end = parts.end;

  		if (end > start)
  		{
    		var glyphs = end - start;
			var result = phext.substr(start, glyphs);
			//console.log(`return: '${result}'.`);
			return result;
  		}

  		return "";
	};

	expand = (phext) => {
	};

	contract = (phext) => {
	};

	dephokenize = (phokens) => {
		var result = "";
  		var coord = new Coordinate();
		for (var i = 0; i < phokens.length; ++i)
		{
			var ph = phokens[i];
			if (ph.scroll.length > 0) {
				result += coord.advance_to(ph.coord);
				result += ph.scroll;
			}
		}
  		return result;
	};

	append_scroll = (token, coord) => {
	};

	subtract = (left, right) => {
	};

	is_phext_break = (byte) => {
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

	normalize = (phext) => {
		var arr = this.phokenize(phext);
		return this.dephokenize(arr);
	};

	to_coordinate = (address) => {
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
				  case 1: result.z.library = parseInt(value); index += 1; break;
				  case 2: result.z.shelf = parseInt(value); index += 1; break;
				  case 3: result.z.series = parseInt(value); index += 1; break;
				  case 4: result.y.collection = parseInt(value); index += 1; break;
				  case 5: result.y.volume = parseInt(value); index += 1; break;
				  case 6: result.y.book = parseInt(value); index += 1; break;
				  case 7: result.x.chapter = parseInt(value); index += 1; break;
				  case 8: result.x.section = parseInt(value); index += 1; break;
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
	constructor(value) {
		this.z = new ZCoordinate(1,1,1);
		this.y = new YCoordinate(1,1,1);
		this.x = new XCoordinate(1,1,1);
		value = "" + value;
		var parts = value.replace(/\//g, '.').split('.');
		if (parts.length >= 1) { this.z.library = parseInt(parts[0]); if (isNaN(this.z.library)) { this.z.library = 1; }}
		if (parts.length >= 2) { this.z.shelf = parseInt(parts[1]); if (isNaN(this.z.shelf)) { this.z.shelf = 1; }}
		if (parts.length >= 3) { this.z.series = parseInt(parts[2]); if (isNaN(this.z.series)) { this.z.series = 1; }}
		if (parts.length >= 4) { this.y.collection = parseInt(parts[3]); if (isNaN(this.y.collection)) { this.z.collection = 1; }}
		if (parts.length >= 5) { this.y.volume = parseInt(parts[4]); if (isNaN(this.y.volume)) { this.y.volume = 1; }}
		if (parts.length >= 6) { this.y.book = parseInt(parts[5]); if (isNaN(this.y.book)) { this.y.book = 1; }}
		if (parts.length >= 7) { this.x.chapter = parseInt(parts[6]); if (isNaN(this.x.chapter)) { this.x.chapter = 1; }}
		if (parts.length >= 8) { this.x.section = parseInt(parts[7]); if (isNaN(this.x.section)) { this.x.section = 1; }}
		if (parts.length >= 9) { this.x.scroll = parseInt(parts[8]); if (isNaN(this.x.scroll)) { this.x.scroll = 1; }}
	}

	equals = (other) => {
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

	less_than = (other) => {
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

	greater_than = (other) => {
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

	advance_to = (other) => {
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

	validate_index = (index) => {
		return index >= __internal_phext.COORDINATE_MINIMUM && index <= __internal_phext.COORDINATE_MAXIMUM;
  	};

	validate_coordinate = () => {
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

	to_string = () => {
		return `${this.z.library}.${this.z.shelf}.${this.z.series}/${this.y.collection}.${this.y.volume}.${this.y.book}/${this.x.chapter}.${this.x.section}.${this.x.scroll}`;
	};

	to_urlencoded = () => {
		return this.to_string().replace(/\//g, ';');
	}

	advance_coordinate = (index) => {
		var next = index + 1;
		if (next < __internal_phext.COORDINATE_MAXIMUM) {
			return next;
		}

		return index;
	};

	library_break = () => {
		this.z.library = this.advance_coordinate(this.z.library);
		this.z.shelf = 1;
		this.z.series = 1;
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	shelf_break = () => {
		this.z.shelf = this.advance_coordinate(this.z.shelf);
		this.z.series = 1;
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	series_break = () => {
		this.z.series = this.advance_coordinate(this.z.series);
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	collection_break = () => {
		this.y.collection = this.advance_coordinate(this.y.collection);
		this.y.volume = 1;
		this.y.book = 1;
		this.x = new XCoordinate();
	};
	volume_break = () => {
		this.y.volume = this.advance_coordinate(this.y.volume);
		this.y.book = 1;
		this.x = new XCoordinate();
	};
	book_break = () => {
		this.y.book = this.advance_coordinate(this.y.book);
		this.x = new XCoordinate();
	};
	chapter_break = () => {
		this.x.chapter = this.advance_coordinate(this.x.chapter);
		this.x.section = 1;
		this.x.scroll = 1;
	};
	section_break = () => {
		this.x.section = this.advance_coordinate(this.x.section);
		this.x.scroll = 1;
	};
	scroll_break = () => {
		this.x.scroll = this.advance_coordinate(this.x.scroll);
	};
}

// internal static data
var __internal_phext = new Phext(); // for constants

// internal classes

class OffsetsAndCoordinate {
	constructor(start, end, coord, fallback) {
		this.start = start;
		this.end = end;
		this.coord = coord;
		this.fallback = fallback;
	}
}

class PositionedScroll {
	constructor(coord, scroll, next, remaining) {
		this.coord = coord;
		this.scroll = scroll;
		this.next = next;
		this.remaining = remaining;
	}
}

class Range {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
}

class ZCoordinate {
	constructor(library, shelf, series) {
		this.library = library ? parseInt(library) : 1;
		this.shelf = shelf ? parseInt(shelf) : 1;
		this.series = series ? parseInt(series) : 1;
	}
}

class YCoordinate {
	constructor(collection, volume, book) {
		this.collection = collection ? parseInt(collection) : 1;
		this.volume = volume ? parseInt(volume) : 1;
		this.book = book ? parseInt(book) : 1;
	}
}

class XCoordinate {
	constructor(chapter, section, scroll) {
		this.chapter = chapter ? parseInt(chapter) : 1;
		this.section = section ? parseInt(section) : 1;
		this.scroll = scroll ? parseInt(scroll) : 1;
	}
}