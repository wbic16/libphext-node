const { Phext, Coordinate } = require("@libphext/core-js");
const phext = new Phext("hello world");
phext.parse();
phext.status();
function verify(test_name, constant, value) {
    console.log(`${test_name}: ${constant == value ? 'OK' : 'Failed'}`);
}
verify('LB', phext.LIBRARY_BREAK, '\x01');
verify('MC', phext.MORE_COWBELL, '\x07');
verify('LF', phext.LINE_BREAK, '\n');
verify('SB', phext.SCROLL_BREAK, '\x17');
verify('SN', phext.SECTION_BREAK, '\x18');
verify('CH', phext.CHAPTER_BREAK, '\x19');
verify('BK', phext.BOOK_BREAK, '\x1A');
verify('VM', phext.VOLUME_BREAK, '\x1C');
verify('CN', phext.COLLECTION_BREAK, '\x1D');
verify('SR', phext.SERIES_BREAK, '\x1E');
verify('SF', phext.SHELF_BREAK, '\x1F');

const coord = new Coordinate("99.98.97/96.95.94/93.92.91");
verify('Z.library', coord.z.library, '99');
verify('Z.shelf', coord.z.shelf, '98');
verify('Z.series', coord.z.series, '97');
verify('Y.collection', coord.y.collection, '96');
verify('Y.volume', coord.y.volume, '95');
verify('Y.book', coord.y.book, '94');
verify('X.chapter', coord.x.chapter, '93');
verify('X.section', coord.x.section, '92');
verify('X.scroll', coord.x.scroll, '91');

var stuff = phext.get_subspace_coordinates('test', '1.1.1/1.1.1/1.1.1');
console.log('subspace_coordinates: ' + stuff.best);

assert_eq = (left, right, message) => {
    if (left != right) { console.log(`Error: '${left}' != '${right}' -- ${message}`); }
    else { console.log(`Passed: '${left}' == '${right}'`); }
};
class Tests {
    constructor() {
        this.test_coordinate_parsing();
    };
    test_coordinate_parsing = () => {
        var example_coordinate = "9.8.7/6.5.4/3.2.1";
        var test = phext.to_coordinate(example_coordinate);
        var address = test.to_string();
        assert_eq(address, example_coordinate, "Coordinate parsing failed");

        let weird_coordinate = "HOME";
        let test_weird = phext.to_coordinate(weird_coordinate).to_string();
        assert_eq("1.1.1/1.1.1/1.1.1", test_weird, "Weird coordinate parsing failed");
    };
};
var runall = new Tests();