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
        Object.keys(this).forEach(key => {
            if (key.startsWith('test_') && typeof this[key] === 'function') {
                this[key]();
            }
        });
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

    _test_helper = (delim, expected, addresses) => {
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

    test_coordinate_based_insert = () => {

        var test = "";
        test += "aaa";               // 1.1.1/1.1.1/1.1.1
        test += phext.LIBRARY_BREAK; // 2.1.1/1.1.1/1.1.1
        test += "bbb";               //
        test += phext.SCROLL_BREAK;  // 2.1.1/1.1.1/1.1.2
        test += "ccc";

        // append 'ddd' after 'ccc'
        const root = phext.to_coordinate("1.1.1/1.1.1/1.1.1");
        const coord1 = phext.to_coordinate("2.1.1/1.1.1/1.1.3");        
        const expected1 = phext.get_subspace_coordinates(test, coord1);
        assert_eq("CBI1", expected1.coord.z.library, 2, "LB");
        assert_eq("CBI2", expected1.coord.z.shelf, 1, "SF");
        assert_eq("CBI3", expected1.coord.z.series, 1, "SR");
        assert_eq("CBI4", expected1.coord.y.collection, 1, "CN");
        assert_eq("CBI5", expected1.coord.y.volume, 1, "VM");
        assert_eq("CBI6", expected1.coord.y.book, 1, "BK");
        assert_eq("CBI7", expected1.coord.x.chapter, 1, "CH");
        assert_eq("CBI8", expected1.coord.x.section, 1, "SN");
        assert_eq("CBI9", expected1.coord.x.scroll, 2, "SC");
        assert_eq("CBI10", expected1.start, 11, "Start");
        assert_eq("CBI11", expected1.end, 11, "End");

        var expected_coord = new Coordinate();
        expected_coord.z.library = 2;
        expected_coord.x.scroll = 3;
        assert_eq("CBI11B", coord1.to_string(), expected_coord.to_string(), "coord 2.1.1/1.1.1/1.1.3");

        const update1 = phext.insert(test, coord1, "ddd");
        assert_eq("CBI12", update1, "aaa\x01bbb\x17ccc\x17ddd", "append 'ddd'");

        // append 'eee' after 'ddd'
        const coord2 = phext.to_coordinate("2.1.1/1.1.1/1.1.4");
        const update2 = phext.insert(update1, coord2, "eee");
        assert_eq("CBI13", update2, "aaa\x01bbb\x17ccc\x17ddd\x17eee", "append 'eee'");

        // append 'fff' after 'eee'
        const coord3 = phext.to_coordinate("2.1.1/1.1.1/1.2.1");
        const update3 = phext.insert(update2, coord3, "fff");
        assert_eq("CBI14", update3, "aaa\x01bbb\x17ccc\x17ddd\x17eee\x18fff", "append 'fff'");

        // append 'ggg' after 'fff'
        const coord4 = phext.to_coordinate("2.1.1/1.1.1/1.2.2");
        const update4 = phext.insert(update3, coord4, "ggg");
        assert_eq("CBI15", update4, "aaa\x01bbb\x17ccc\x17ddd\x17eee\x18fff\x17ggg", "append 'ggg'");

        // append 'hhh' after 'ggg'
        const coord5 = phext.to_coordinate("2.1.1/1.1.1/2.1.1");
        const update5 = phext.insert(update4, coord5, "hhh");
        assert_eq("CBI16", update5, "aaa\x01bbb\x17ccc\x17ddd\x17eee\x18fff\x17ggg\x19hhh", "append 'hhh'");

        // append 'iii' after 'eee'
        const coord6 = phext.to_coordinate("2.1.1/1.1.1/1.1.5");
        const update6 = phext.insert(update5, coord6, "iii");
        assert_eq("CBI17", update6, "aaa\x01bbb\x17ccc\x17ddd\x17eee\x17iii\x18fff\x17ggg\x19hhh", "insert 'iii'");

        // extend 1.1.1/1.1.1/1.1.1 with '---AAA'
        const update7 = phext.insert(update6, root, "---AAA");
        assert_eq("CBI18", update7, "aaa---AAA\x01bbb\x17ccc\x17ddd\x17eee\x17iii\x18fff\x17ggg\x19hhh", "prepend '---AAA'");

        // extend 2.1.1/1.1.1/1.1.1 with '---BBB'
        const coord8 = phext.to_coordinate("2.1.1/1.1.1/1.1.1");
        const update8 = phext.insert(update7, coord8, "---BBB");
        assert_eq("CBI19", update8, "aaa---AAA\x01bbb---BBB\x17ccc\x17ddd\x17eee\x17iii\x18fff\x17ggg\x19hhh", "extend '---BBB'");

        // extend 2.1.1/1.1.1/1.1.2 with '---CCC'
        const coord9 = phext.to_coordinate("2.1.1/1.1.1/1.1.2");
        const update9 = phext.insert(update8, coord9, "---CCC");
        assert_eq("CBI20", update9, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd\x17eee\x17iii\x18fff\x17ggg\x19hhh", "extend '---CCC'");

        // extend 2.1.1/1.1.1/1.1.3 with '---DDD'
        const coord10 = phext.to_coordinate("2.1.1/1.1.1/1.1.3");
        const update10 = phext.insert(update9, coord10, "---DDD");
        assert_eq("CBI21", update10, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee\x17iii\x18fff\x17ggg\x19hhh", "extend '---DDD'");

        // extend 2.1.1/1.1.1/1.1.4 with '---EEE'
        const coord11 = phext.to_coordinate("2.1.1/1.1.1/1.1.4");
        const update11 = phext.insert(update10, coord11, "---EEE");
        assert_eq("CBI22", update11, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii\x18fff\x17ggg\x19hhh", "extend '---EEE'");

        // extend 2.1.1/1.1.1/1.1.5 with '---III'
        const coord12 = phext.to_coordinate("2.1.1/1.1.1/1.1.5");
        const update12 = phext.insert(update11, coord12, "---III");
        assert_eq("CBI23", update12, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff\x17ggg\x19hhh", "extend '---III'");

        // extend 2.1.1/1.1.1/1.2.1 with '---FFF'
        const coord13 = phext.to_coordinate("2.1.1/1.1.1/1.2.1");
        const update13 = phext.insert(update12, coord13, "---FFF");
        assert_eq("CBI24", update13, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg\x19hhh", "extend '---FFF'");

        // extend 2.1.1/1.1.1/1.2.2 with '---GGG'
        const coord14 = phext.to_coordinate("2.1.1/1.1.1/1.2.2");
        const update14 = phext.insert(update13, coord14, "---GGG");
        assert_eq("CBI25", update14, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh", "extend '---GGG'");

        // extend 2.1.1/1.1.1/2.1.1 with '---HHH'
        const coord15 = phext.to_coordinate("2.1.1/1.1.1/2.1.1");
        const update15 = phext.insert(update14, coord15, "---HHH");
        assert_eq("CBI26", update15, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH", "extend '---HHH'");

        // insert 'jjj' at 2.1.1/1.1.2/1.1.1
        const coord16 = phext.to_coordinate("2.1.1/1.1.2/1.1.1");
        const update16 = phext.insert(update15, coord16, "jjj");
        assert_eq("CBI27", update16, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH\x1Ajjj", "append '---jjj'");

        // insert 'kkk' at 2.1.1/1.2.1/1.1.1
        const coord17 = phext.to_coordinate("2.1.1/1.2.1/1.1.1");
        const update17 = phext.insert(update16, coord17, "kkk");
        assert_eq("CBI28", update17, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH\x1Ajjj\x1Ckkk", "append 'kkk'");

        // insert 'lll' at 2.1.1/2.1.1/1.1.1
        const coord18 = phext.to_coordinate("2.1.1/2.1.1/1.1.1");
        const update18 = phext.insert(update17, coord18, "lll");
        assert_eq("CBI29", update18, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH\x1Ajjj\x1Ckkk\x1Dlll", "append 'lll'");

        // insert 'mmm' at 2.1.2/1.1.1/1.1.1
        const coord19 = phext.to_coordinate("2.1.2/1.1.1/1.1.1");
        const update19 = phext.insert(update18, coord19, "mmm");
        assert_eq("CBI30", update19, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH\x1Ajjj\x1Ckkk\x1Dlll\x1Emmm", "append 'mmm'");

        // insert 'nnn' at 2.2.1/1.1.1/1.1.1
        const coord20 = phext.to_coordinate("2.2.1/1.1.1/1.1.1");
        const update20 = phext.insert(update19, coord20, "nnn");
        assert_eq("CBI31", update20, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH\x1Ajjj\x1Ckkk\x1Dlll\x1Emmm\x1Fnnn", "append 'nnn'");

        // insert 'ooo' at 3.1.1/1.1.1/1.1.1
        const coord21 = phext.to_coordinate("3.1.1/1.1.1/1.1.1");
        const update21 = phext.insert(update20, coord21, "ooo");
        assert_eq("CBI32", update21, "aaa---AAA\x01bbb---BBB\x17ccc---CCC\x17ddd---DDD\x17eee---EEE\x17iii---III\x18fff---FFF\x17ggg---GGG\x19hhh---HHH\x1Ajjj\x1Ckkk\x1Dlll\x1Emmm\x1Fnnn\x01ooo", "append 'ooo'");
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

        const result = this._test_helper(phext.SCROLL_BREAK, expected, addresses);
        assert_eq("Scrolls", result, true);
    };
};
var runall = new Tests();
const result = failed == 0 ? "Success" : "Failure";
console.log(`Result: ${result} (${passed} passed ${failed} failed)`);