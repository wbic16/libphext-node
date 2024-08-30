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

var stuff = phext.get_subspace_coordinates('test', phext.to_coordinate('1.1.1/1.1.1/1.1.1'));
console.log('subspace_coordinates: ' + stuff.best);

const verbose = false;
var passed = 0;
var failed = 0;
assert_eq = (tc, left, right, message) => {
    if (left != right) { console.log(`${tc}: Error: '${left}' != '${right}' -- ${message}`); ++failed; }
    else if (verbose) { console.log(`${tc}: Passed: '${left}' == '${right}'`); ++passed; }
    else { console.log(`${tc}: OK`); ++passed; }
};

class Tests {
    constructor() {
        this.test_coordinate_parsing();
        this.test_to_urlencoded();
        this.test_scrolls();
    };
    test_coordinate_parsing = () => {
        const example_coordinate = "9.8.7/6.5.4/3.2.1";
        var test = phext.to_coordinate(example_coordinate);
        var address = test.to_string();
        assert_eq("CP", address, example_coordinate, "Coordinate parsing failed");

        const weird_coordinate = "HOME";
        let test_weird = phext.to_coordinate(weird_coordinate).to_string();
        assert_eq("CP", "1.1.1/1.1.1/1.1.1", test_weird, "Weird coordinate parsing failed");
    };

    test_to_urlencoded = () => {
        const sample1 = phext.to_coordinate("1.1.1/1.1.1/1.1.1");
        const result1 = sample1.to_urlencoded();
        assert_eq("UE", result1, "1.1.1;1.1.1;1.1.1");

        const sample2 = phext.to_coordinate("98.76.54/32.10.1/23.45.67");
        const result2 = sample2.to_urlencoded();
        assert_eq("UE", result2, "98.76.54;32.10.1;23.45.67");
    };

    test_helper = (delim, expected, addresses) => {
        var index = 0;
        var expect1 = "not set";
        var expect2 = "not set";
        var expect3 = "not set";
        var address1 = "not set";
        var address2 = "not set";
        var address3 = "not set";
        if (expected.length < 3 || addresses.length < 3) {
            return false;
        }
        console.log(`expected: ${expected[0]}, addresses: ${addresses[0]}`);
        for (var index = 0; index < expected.length; index++) {
            if (index == 0) { expect1 = expected[index]; address1 = addresses[index]; }
            if (index == 1) { expect2 = expected[index]; address2 = addresses[index]; }
            if (index == 2) { expect3 = expected[index]; address3 = addresses[index]; }
        }
        const sample = `${expect1}${delim}${expect2}${delim}${expect3}`;

        assert_eq("SA", sample.length, 89, "incorrect sample length");

        const coord1 = phext.to_coordinate(address1);
        const coord2 = phext.to_coordinate(address2);
        const coord3 = phext.to_coordinate(address3);

        const text1 = phext.fetch(sample, coord1);
        assert_eq("C1", text1, expect1, `Fetching text for coord1 failed - '${text1}' vs '${expect1}'`);

        const text2 = phext.fetch(sample, coord2);
        assert_eq("C2", text2, expect2, `Fetching text for coord2 failed - '${text2}' vs '${expect2}'`);

        const text3 = phext.fetch(sample, coord3);
        assert_eq("C3", text3, expect3, `Fetching text for coord3 failed - '${text3}' vs '${expect3}'`);

        return true;
    };

    test_scrolls = () => {
        const expected = Array(
            "Hello World",
            "Scroll #2 -- this text will be selected",
            "Scroll #3 - this text will be ignored"
        );
        const addresses = Array(
            "1.1.1/1.1.1/1.1.1",
            "1.1.1/1.1.1/1.1.2",
            "1.1.1/1.1.1/1.1.3"
        );

        const result = this.test_helper(phext.SCROLL_BREAK, expected, addresses);
        assert_eq("Scrolls", result, true);
    };
};
var runall = new Tests();
const result = failed == 0 ? "Success" : "Failure";
console.log(`Result: ${result} (${passed} passed ${failed} failed)`);