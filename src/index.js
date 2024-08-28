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
		this.COORDINATE_MINIMUM  = 1;
    	this.COORDINATE_MAXIMUM  = 100;
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
}
class ZCoordinate {
	constructor(library, shelf, series) {
		this.library = library;
		this.shelf = shelf;
		this.series = series;
	}
}
class YCoordinate {
	constructor(collection, volume, book) {
		this.collection = collection;
		this.volume = volume;
		this.book = book;
	}
}
class XCoordinate {
	constructor(chapter, section, scroll) {
		this.chapter = chapter;
		this.section = section;
		this.scroll = scroll;
	}
}
export class Coordinate {
	constructor(value) {
		this.z = new ZCoordinate('1', '1', '1');
		this.y = new YCoordinate('1', '1', '1');
		this.x = new XCoordinate('1', '1', '1');
		var parts = value.replace(/\//g, '.').split('.');
		if (parts.length >= 3)
		{
			this.z.library = parts[0];
			this.z.shelf = parts[1];
			this.z.series = parts[2];
		}
		if (parts.length >= 6)
		{
			this.y.collection = parts[3];
			this.y.volume = parts[4];
			this.y.book = parts[5];
		}
		if (parts.length >= 9)
		{
			this.x.chapter = parts[6];
			this.x.section = parts[7];
			this.x.scroll = parts[8];
		}
	}
}