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
	parse = () => {
		console.log("Parsing phext!");
		if (this.subspace.length > 0) {
			console.log(`parsing ${this.subspace.length} bytes`);
			this.state = 'parsing';
		} else {
			console.log("Nothing to parse.");
		}
	};
	status = () => {
		console.log(`Length: ${this.subspace.length}`);
		console.log(`state: ${this.state}`);
	};

	get_subspace_coordinates = (subspace, target) => {
		// stub - see lines 315-371 in phext.rs
		return new OffsetsAndCoordinate(1, 1, target);
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
		var phokens = phokenize(phext);
		for (var i = 0; i < phokens.length; ++i) {
		  phokens[i].scroll = checksum(phokens[i].scroll);
		  ++i;
		}
	  
		return dephokenize(phokens);
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
		var phokens = phokenize(phext);
		
		for (var i = 0; i < phokens.length; ++i) {
		  phokens[i].scroll = soundex_internal(phokens[i].scroll);
		}
	  
		return dephokenize(phokens);
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
		return dephokenize(output);
	};

	offset = (phext, coord) => {
		var output = index_phokens(phext);
	  
		var best = default_coordinate();
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
		var parts = get_subspace_coordinates(phext, location);
		var start = parts.start;
		var end = parts.end;
		var fixup = Array();
		var subspace_coordinate = parts.coord;
	  
		while (subspace_coordinate.z.library < location.z.library) {
		  fixup += this.LIBRARY_BREAK;
		  subspace_coordinate.library_break();
		}
		while (subspace_coordinate.z.shelf < location.z.shelf) {
		  fixup += this.SHELF_BREAK;
		  subspace_coordinate.shelf_break();
		}
		while (subspace_coordinate.z.series < location.z.series) {
		  fixup += this.SERIES_BREAK;
		  subspace_coordinate.series_break();
		}
		while (subspace_coordinate.y.collection < location.y.collection) {
		  fixup += this.COLLECTION_BREAK;
		  subspace_coordinate.collection_break();
		}
		while (subspace_coordinate.y.volume < location.y.volume) {
		  fixup.push += this.VOLUME_BREAK;
		  subspace_coordinate.volume_break();
		}
		while (subspace_coordinate.y.book < location.y.book) {
		  fixup += this.BOOK_BREAK;
		  subspace_coordinate.book_break();
		}
		while (subspace_coordinate.x.chapter < location.x.chapter) {
		  fixup += this.CHAPTER_BREAK;
		  subspace_coordinate.chapter_break();
		}
		while (subspace_coordinate.x.section < location.x.section) {
		  fixup += this.SECTION_BREAK;
		  subspace_coordinate.section_break();
		}
		while (subspace_coordinate.x.scroll < location.x.scroll) {
		  fixup += SCROLL_BREAK;
		  subspace_coordinate.scroll_break();
		}

		var text = scroll;
		var max = scroll.length;
		if (end > max) { end = max; }
		var left = scroll.substr(0, start);
		var right = scroll.substr(end);
		var temp = left + text + right;
		return temp;
	};

	range_replace = (phext, location, scroll) => {
	};

	insert = (phext, location, scroll) => {
	};

	next_scroll = (phext, start) => {
	};

	phokenize = (phext) => {
	};

	merge = (left, right) => {
	};

	fetch = (phext, target) => {
	};

	expand = (phext) => {
	};

	contract = (phext) => {
	};

	dephokenize = (tokens) => {
	};

	append_scroll = (token, coord) => {
	};

	subtract = (left, right) => {
	};

	is_phext_break = (byte) => {
	};

	normalize = (phext) => {
		var arr = phokenize(phext);
		return dephokenize(arr);
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
class ZCoordinate {
	constructor(library, shelf, series) {
		this.library = parseInt(library);
		this.shelf = parseInt(shelf);
		this.series = parseInt(series);
	}
}
class YCoordinate {
	constructor(collection, volume, book) {
		this.collection = parseInt(collection);
		this.volume = parseInt(volume);
		this.book = parseInt(book);
	}
}
class XCoordinate {
	constructor(chapter, section, scroll) {
		this.chapter = parseInt(chapter);
		this.section = parseInt(section);
		this.scroll = parseInt(scroll);
	}
}
export class Coordinate {
	constructor(value) {
		this.z = new ZCoordinate('1', '1', '1');
		this.y = new YCoordinate('1', '1', '1');
		this.x = new XCoordinate('1', '1', '1');
		this.COORDINATE_MINIMUM  = 1;
    	this.COORDINATE_MAXIMUM  = 100;
		value = "" + value;
		var parts = value.replace(/\//g, '.').split('.');
		if (parts.length >= 3)
		{
			this.z.library = parseInt(parts[0]);
			this.z.shelf = parseInt(parts[1]);
			this.z.series = parseInt(parts[2]);
		}
		if (parts.length >= 6)
		{
			this.y.collection = parseInt(parts[3]);
			this.y.volume = parseInt(parts[4]);
			this.y.book = parseInt(parts[5]);
		}
		if (parts.length >= 9)
		{
			this.x.chapter = parseInt(parts[6]);
			this.x.section = parseInt(parts[7]);
			this.x.scroll = parseInt(parts[8]);
		}
	}

	validate_index = (index) => {
		return index >= this.COORDINATE_MINIMUM && index <= this.COORDINATE_MAXIMUM;
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
		if (!this.validate_coordinate()) {
		  return "";
		}

		return `${this.z.library}.${this.z.shelf}.${this.z.series}/${this.y.collection}.${this.y.volume}.${this.y.book}/${this.x.chapter}.${this.x.section}.${this.x.scroll}`;
	};

	to_urlencoded = () => {
		return this.to_string().replace(/\//g, ';');
	}

	advance_coordinate = (index) => {
		var next = index + 1;
		if (next < COORDINATE_MAXIMUM) {
		  return next;
		}
	
		return index;
	};

	library_break = () => {
		this.z.library = advance_coordinate(this.z.library);
		this.z.shelf = 1;
		this.z.series = 1;
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	shelf_break = () => {
		this.z.shelf = advance_coordinate(this.z.shelf);
		this.z.series = 1;
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	series_break = () => {
		this.z.series = advance_coordinate(this.z.series);
		this.y = new YCoordinate();
		this.x = new XCoordinate();
	};
	collection_break = () => {
		this.y.collection = advance_coordinate(this.y.collection);
		this.y.volume = 1;
		this.y.book = 1;
		this.x = new XCoordinate();
	};
	volume_break = () => {
		this.y.volume = advance_coordinate(this.y.volume);
		this.y.book = 1;
		this.x = new XCoordinate();
	};
	book_break = () => {
		this.y.book = advance_coordinate(this.y.book);
		this.x = new XCoordinate();
	};
	chapter_break = () => {
		this.x.chapter = advance_coordinate(this.x.chapter);
		this.x.section = 1;
		this.x.scroll = 1;
	};
	section_break = () => {
		this.x.section = advance_coordinate(this.x.section);
		this.x.scroll = 1;
	};
	scroll_break = () => {
		this.x.scroll = advance_coordinate(this.x.scroll);
	};
}
class OffsetsAndCoordinate {
	constructor(start, end, best) {
		this.start = start;
		this.end = end;
		this.best = best;
	}
}