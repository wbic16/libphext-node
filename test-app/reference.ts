// Test-only reference: the tokenizer and subspace scan of libphext <= 0.1.10, copied verbatim from
// src/index.ts before the linear-time rewrite (only the class wrapper and type imports differ).
// ReferencePhext inherits every other method from Phext, so fetch/insert/replace/textmap/index/...
// run on top of the old code paths and can be compared output-for-output with the current library.
import { Phext, Coordinate } from "libphext";

// these classes are not exported; recover their constructors from values the library hands out
const PositionedScroll: any = new Phext().create_positioned_scroll(new Coordinate(), "").constructor;
const OffsetsAndCoordinate: any = new Phext().get_subspace_coordinates("", new Coordinate()).constructor;
type PositionedScroll = any;
type OffsetsAndCoordinate = any;

export class ReferencePhext extends Phext {
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
}
