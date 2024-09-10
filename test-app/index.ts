import { Phext, Coordinate } from "libphext";
import * as fs from 'fs';

const phext = new Phext();

function verify_string(test_name: string, constant: string, value: string) {
    console.log(`${test_name}: ${constant == value ? 'OK' : 'Failed'}`);
}
function verify_number(test_name: string, constant: number, value: number) {
    console.log(`${test_name}: ${constant == value ? 'OK' : 'Failed'}`);
}
verify_string('LB', phext.LIBRARY_BREAK, '\x01');
verify_string('MC', phext.MORE_COWBELL, '\x07');
verify_string('LF', phext.LINE_BREAK, '\n');
verify_string('SB', phext.SCROLL_BREAK, '\x17');
verify_string('SN', phext.SECTION_BREAK, '\x18');
verify_string('CH', phext.CHAPTER_BREAK, '\x19');
verify_string('BK', phext.BOOK_BREAK, '\x1A');
verify_string('VM', phext.VOLUME_BREAK, '\x1C');
verify_string('CN', phext.COLLECTION_BREAK, '\x1D');
verify_string('SR', phext.SERIES_BREAK, '\x1E');
verify_string('SF', phext.SHELF_BREAK, '\x1F');

const coord = new Coordinate("99.98.97/96.95.94/93.92.91");
verify_number('Z.library', coord.z.library, 99);
verify_number('Z.shelf', coord.z.shelf, 98);
verify_number('Z.series', coord.z.series, 97);
verify_number('Y.collection', coord.y.collection, 96);
verify_number('Y.volume', coord.y.volume, 95);
verify_number('Y.book', coord.y.book, 94);
verify_number('X.chapter', coord.x.chapter, 93);
verify_number('X.section', coord.x.section, 92);
verify_number('X.scroll', coord.x.scroll, 91);

var expected_coord = phext.to_coordinate('1.1.1/1.1.1/1.1.1');
console.log(`expected_coordinate: ${expected_coord.to_string()}`);

var stuff = phext.get_subspace_coordinates('test', expected_coord);
console.log(`subspace_coordinates: ${stuff.coord.to_string()}`);

const verbose = false;
var passed = 0;
var failed = 0;
function assert_number_eq(tc: string, left: number, right: number, message: string = '') {
    assert_eq(tc, left.toString(), right.toString(), message);
}
function assert_eq(tc: string, left: string, right: string, message: string = '') {
    if (left != right) { console.log(`${tc}: Error: '${left}' != '${right}' -- ${message}`); ++failed; }
    else if (verbose) { console.log(`${tc}: Passed: '${left}' == '${right}'`); ++passed; }
    else { console.log(`${tc}: OK`); ++passed; }
}
function assert_true(tc: string, value: boolean, message: string = '') {
    assert_eq(tc, value ? 'true' : 'false', 'true', message);
}
function assert_false(tc: string, value: boolean, message: string = '') {
    assert_eq(tc, value ? 'true' : 'false', 'false', message);
}

class Tests {
    constructor() {
    };
    run = () => {
        /*
        Object.keys(this).forEach(key => {
            if (key.startsWith('test_')) {
                this[key]();
            } else {
                console.log(`----------------------- Ignoring ${key}`);
            }
        });*/

        // TODO: why aren't these being found by Object.keys?
        this.test_coordinate_parsing();
        this.test_to_urlencoded();
        this.test_scrolls();
        this.test_coordinate_validity();
        this.test_coordinate_based_insert();
        this.test_coordinate_based_remove();
        this.test_coordinate_based_replace();
        this.test_next_scroll();
        this.test_range_based_replace();
        this.test_dead_reckoning();
        this.test_line_break();
        this.test_more_cowbell();
        this.test_phokenize();
        this.test_merge();
        this.test_subtract();
        this.test_normalize();
        this.test_expand();
        this.test_contract();
        this.test_fs_read_write();
        this.test_replace_create();
        this.test_summary();
        this.test_navmap();
        this.test_textmap();
        this.test_phext_index();
        //this.test_scroll_manifest();
        this.test_phext_soundex_v1();
    };

    test_coordinate_parsing = () => {
        const example_coordinate = "9.8.7/6.5.4/3.2.1";
        var test = phext.to_coordinate(example_coordinate);
        var address = test.to_string();
        assert_eq("CP", address, example_coordinate, "Coordinate parsing failed");

        const weird_coordinate = "HOME";
        const test_weird = phext.to_coordinate(weird_coordinate).to_string();
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

        assert_number_eq("SA", sample.length, 89, "incorrect sample length");

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
        assert_number_eq("CBI1", expected1.coord.z.library, 2, "LB");
        assert_number_eq("CBI2", expected1.coord.z.shelf, 1, "SF");
        assert_number_eq("CBI3", expected1.coord.z.series, 1, "SR");
        assert_number_eq("CBI4", expected1.coord.y.collection, 1, "CN");
        assert_number_eq("CBI5", expected1.coord.y.volume, 1, "VM");
        assert_number_eq("CBI6", expected1.coord.y.book, 1, "BK");
        assert_number_eq("CBI7", expected1.coord.x.chapter, 1, "CH");
        assert_number_eq("CBI8", expected1.coord.x.section, 1, "SN");
        assert_number_eq("CBI9", expected1.coord.x.scroll, 2, "SC");
        assert_number_eq("CBI10", expected1.start, 11, "Start");
        assert_number_eq("CBI11", expected1.end, 11, "End");

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

        // double-check progress so far
        const u5a = phext.fetch(update5, phext.to_coordinate("1.1.1/1.1.1/1.1.1")); // aaa
        const u5b = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/1.1.1")); // bbb
        const u5c = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/1.1.2")); // ccc
        const u5d = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/1.1.3")); // ddd
        const u5e = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/1.1.4")); // eee
        const u5f = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/1.2.1")); // fff
        const u5g = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/1.2.2")); // ggg
        const u5h = phext.fetch(update5, phext.to_coordinate("2.1.1/1.1.1/2.1.1")); // hhh
        assert_eq("CBI16-1", u5a, "aaa", "fetch check aaa");
        assert_eq("CBI16-2", u5b, "bbb", "fetch check bbb");
        assert_eq("CBI16-3", u5c, "ccc", "fetch check ccc");
        assert_eq("CBI16-4", u5d, "ddd", "fetch check ddd");
        assert_eq("CBI16-5", u5e, "eee", "fetch check eee");
        assert_eq("CBI16-6", u5f, "fff", "fetch check fff");
        assert_eq("CBI16-7", u5g, "ggg", "fetch check ggg");
        assert_eq("CBI16-8", u5h, "hhh", "fetch check hhh");

        const u5coord1 = phext.to_coordinate("2.1.1/1.1.1/1.1.4");
        const u5coord2 = phext.to_coordinate("2.1.1/1.1.1/1.2.1");
        const check1 = u5coord1.less_than(u5coord2);
        const check2 = u5coord2.less_than(u5coord1);
        assert_true("CBI16-9", check1, "2.1.1/1.1.1/1.1.4 is less than 2.1.1/1.1.1/1.2.1");
        assert_false("CBI16-10", check2, "2.1.1/1.1.1/1.2.1 is not less than 2.1.1/1.1.1/1.1.4");

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
        assert_true("Scrolls", result);
    };

    // note: these tests were written early in the rust implementation
    // they're just boiler-plate/dummy tests (other tests definitely fail if they do)
    // * test_sections
    // * test_chapters
    // * test_books
    // * test_volumes
    // * test_collections
    // * test_series
    // * test_shelves
    // * test_libraries
    
    test_coordinate_validity = () => {
        const c1 = phext.to_coordinate("0.0.0/0.0.0/0.0.0"); // invalid
        var c2 = new Coordinate();
        c2.z.library = 0; c2.z.shelf = 0; c2.z.series = 0;
        c2.y.collection = 0; c2.y.volume = 0; c2.y.book = 0;
        c2.x.chapter = 0; c2.x.section = 0; c2.x.scroll = 0;
        assert_eq("CV1", c1.to_string(), c2.to_string(), "null coordinate");

        const c1b = c1.validate_coordinate();
        const c2b = c2.validate_coordinate();
        assert_false("CV2", c1b, "Invalid parsed");
        assert_false("CV3", c2b, "Invalid created");

        const c3 = new Coordinate();
        assert_true("CV4", c3.validate_coordinate(), "default valid");
    
        const c4 = phext.to_coordinate("255.254.253/32.4.8/4.2.1"); // valid
        const c5 = new Coordinate();
        c5.z.library = 255; c5.z.shelf = 254; c5.z.series = 253;
        c5.y.collection = 32; c5.y.volume = 4; c5.y.book = 8;
        c5.x.chapter = 4; c5.x.section = 2; c5.x.scroll = 1;
        assert_eq("CV5", c4.to_string(), c5.to_string(), "parse vs create");
        assert_number_eq("CV6", c4.y.volume, 4, "spot check");
        const c4b = c4.validate_coordinate();
        const c5b = c5.validate_coordinate();
        assert_false("CV7", c4b, "out of range");
        assert_false("CV8", c5b, "out of range");

        const c6 = new Coordinate("11.12.13/14.15.16/17.18.19");
        assert_true("CV9", c6.validate_coordinate(), "valid coordinate");
    };

    test_coordinate_based_replace() {
        // replace 'AAA' with 'aaa'
        const coord0 = phext.to_coordinate("1.1.1/1.1.1/1.1.1");
        const update0 = phext.replace("AAA\x17bbb\x18ccc\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", coord0, "aaa");
        assert_eq("CBR1", update0, "aaa\x17bbb\x18ccc\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "AAA -> aaa");

        // replace 'bbb' with '222'
        const coord1 = phext.to_coordinate("1.1.1/1.1.1/1.1.2");
        const update1 = phext.replace(update0, coord1, "222");
        assert_eq("CBR2", update1, "aaa\x17222\x18ccc\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "bbb -> 222");

        // replace 'ccc' with '3-'
        const coord2 = phext.to_coordinate("1.1.1/1.1.1/1.2.1");
        const update2 = phext.replace(update1, coord2, "3-");
        assert_eq("CBR3", update2, "aaa\x17222\x183-\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "ccc -> 3-");

        // replace 'ddd' with 'delta'
        const coord3 = phext.to_coordinate("1.1.1/1.1.1/2.1.1");
        const update3 = phext.replace(update2, coord3, "delta");
        assert_eq("CBR4", update3, "aaa\x17222\x183-\x19delta\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "ddd -> delta");

        // replace 'eee' with 'a bridge just close enough'
        const coord4 = phext.to_coordinate("1.1.1/1.1.2/1.1.1");
        const update4 = phext.replace(update3, coord4, "a bridge just close enough");
        assert_eq("CBR5", update4, "aaa\x17222\x183-\x19delta\x1Aa bridge just close enough\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "eee -> a bridge...");

        // replace 'fff' with 'nifty'
        const coord5 = phext.to_coordinate("1.1.1/1.2.1/1.1.1");
        const update5 = phext.replace(update4, coord5, "nifty");
        assert_eq("CBR6", update5, "aaa\x17222\x183-\x19delta\x1Aa bridge just close enough\x1Cnifty\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "fff -> nifty");

        // replace 'ggg' with 'G8'
        const coord6 = phext.to_coordinate("1.1.1/2.1.1/1.1.1");
        const update6 = phext.replace(update5, coord6, "G8");
        assert_eq("CBR7", update6, "aaa\x17222\x183-\x19delta\x1Aa bridge just close enough\x1Cnifty\x1DG8\x1Ehhh\x1Fiii\x01jjj", "ggg -> G8");

        // replace 'hhh' with 'Hello World'
        const coord7 = phext.to_coordinate("1.1.2/1.1.1/1.1.1");
        const update7 = phext.replace(update6, coord7, "Hello World");
        assert_eq("CBR8", update7, "aaa\x17222\x183-\x19delta\x1Aa bridge just close enough\x1Cnifty\x1DG8\x1EHello World\x1Fiii\x01jjj", "hhh -> Hello World");

        // replace 'iii' with '_o_'
        const coord8 = phext.to_coordinate("1.2.1/1.1.1/1.1.1");
        const update8 = phext.replace(update7, coord8, "_o_");
        assert_eq("CBR9", update8, "aaa\x17222\x183-\x19delta\x1Aa bridge just close enough\x1Cnifty\x1DG8\x1EHello World\x1F_o_\x01jjj", "iii -> _o_");

        // replace 'jjj' with '/win'
        const coord9 = phext.to_coordinate("2.1.1/1.1.1/1.1.1");
        const update9 = phext.replace(update8, coord9, "/win");
        assert_eq("CBR10", update9, "aaa\x17222\x183-\x19delta\x1Aa bridge just close enough\x1Cnifty\x1DG8\x1EHello World\x1F_o_\x01/win", "jjj -> /win");

        // the api editor had trouble with this input...
        const coord_r0a = phext.to_coordinate("2.1.1/1.1.1/1.1.5");
        const update_r0a = phext.replace("hello world\x17scroll two", coord_r0a, "2.1.1-1.1.1-1.1.5");
        assert_eq("CBR11", update_r0a, "hello world\x17scroll two\x01\x17\x17\x17\x172.1.1-1.1.1-1.1.5", "editor check");

        // regression from api testing
        // unit tests don't hit the failure I'm seeing through rocket...hmm - seems to be related to using library breaks
        const coord_r1a = phext.to_coordinate("1.1.1/1.1.1/1.1.1");
        const update_r1a = phext.replace("", coord_r1a, "aaa");
        assert_eq("CBR12", update_r1a, "aaa", "editor regression");

        const coord_r1b = phext.to_coordinate("1.1.1/1.1.1/1.1.2");
        const update_r1b = phext.replace(update_r1a, coord_r1b, "bbb");
        assert_eq("CBR13", update_r1b, "aaa\x17bbb", "editor regression");

        const coord_r1c = phext.to_coordinate("1.2.3/4.5.6/7.8.9");
        const update_r1c = phext.replace(update_r1b, coord_r1c, "ccc");
        assert_eq("CBR14", update_r1c, "aaa\x17bbb\x1F\x1E\x1E\x1D\x1D\x1D\x1C\x1C\x1C\x1C\x1A\x1A\x1A\x1A\x1A\x19\x19\x19\x19\x19\x19\x18\x18\x18\x18\x18\x18\x18\x17\x17\x17\x17\x17\x17\x17\x17ccc", "editor regression");

        const coord_r1d = phext.to_coordinate("1.4.4/2.8.8/4.16.16");
        const update_r1d = phext.replace(update_r1c, coord_r1d, "ddd");
        assert_eq("CBR15", update_r1d, "aaa\x17bbb\x1F\x1E\x1E\x1D\x1D\x1D\x1C\x1C\x1C\x1C\x1A\x1A\x1A\x1A\x1A\x19\x19\x19\x19\x19\x19\x18\x18\x18\x18\x18\x18\x18\x17\x17\x17\x17\x17\x17\x17\x17ccc\x1F\x1F\x1E\x1E\x1E\x1D\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x19\x19\x19\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17ddd", "editor regression");

        const coord_regression_1 = phext.to_coordinate("11.12.13/14.15.16/17.18.19");
        const update_regression_1 = phext.replace(update_r1d, coord_regression_1, "eee");
        assert_eq("CBR16", update_regression_1, "aaa\x17bbb\x1F\x1E\x1E\x1D\x1D\x1D\x1C\x1C\x1C\x1C\x1A\x1A\x1A\x1A\x1A\x19\x19\x19\x19\x19\x19\x18\x18\x18\x18\x18\x18\x18\x17\x17\x17\x17\x17\x17\x17\x17ccc\x1F\x1F\x1E\x1E\x1E\x1D\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x19\x19\x19\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17ddd" +
        "\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01" +
        "\x1F\x1F\x1F\x1F\x1F\x1F\x1F\x1F\x1F\x1F\x1F" +
        "\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E\x1E" +
        "\x1D\x1D\x1D\x1D\x1D\x1D\x1D\x1D\x1D\x1D\x1D\x1D\x1D" +
        "\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C\x1C" +
        "\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A\x1A" +
        "\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19\x19" +
        "\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18\x18" +
        "\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17\x17" +
        "eee", "editor regression");

        // finally found the bugger!
        const coord_regression_2 = phext.to_coordinate("1.1.1/1.1.2/1.1.2");
        const regression_2_baseline = "1.1.1\x171.1.2\x171.1.3\x171.1.4\x181.2.1\x171.2.2\x171.2.3\x171.2.4\x192.1.1\x193.1.1\x194.1.1\x1a2/1.1.1\x17\x172/1.1.3\x1c2.1/1.1.1\x1d2.1.1/1.1.1\x1e2/1.1.1/1.1.1\x1f2.1/1.1.1/1.1.1\x012.1.1/1.1.1/1.1.1";
        const update_regression_2 = phext.replace(regression_2_baseline, coord_regression_2, "new content");
        assert_eq("CBR17", update_regression_2, "1.1.1\x171.1.2\x171.1.3\x171.1.4\x181.2.1\x171.2.2\x171.2.3\x171.2.4\x192.1.1\x193.1.1\x194.1.1\x1a2/1.1.1\x17new content\x172/1.1.3\x1c2.1/1.1.1\x1d2.1.1/1.1.1\x1e2/1.1.1/1.1.1\x1f2.1/1.1.1/1.1.1\x012.1.1/1.1.1/1.1.1", "editor regression");
    };

    test_next_scroll() {
        const doc1 = "3A\x17B2\x18C1";
        const fetched1 = phext.next_scroll(doc1, phext.to_coordinate("1.1.1/1.1.1/1.1.1"));
        assert_eq("NS1", fetched1.coord.to_string(), "1.1.1/1.1.1/1.1.1", "first scroll");
        assert_eq("NS2", fetched1.scroll, "3A", "content");
        assert_eq("NS3", fetched1.next.to_string(), "1.1.1/1.1.1/1.1.2", "second scroll");
        assert_eq("NS4", fetched1.remaining, "B2\x18C1", "remaining");

        const fetched2 = phext.next_scroll(fetched1.remaining, fetched1.next);
        assert_eq("NS5", fetched2.coord.to_string(), "1.1.1/1.1.1/1.1.2", "second scroll");
        assert_eq("NS6", fetched2.scroll, "B2", "content");
        assert_eq("NS7", fetched2.next.to_string(), "1.1.1/1.1.1/1.2.1", "second scroll");
        assert_eq("NS8", fetched2.remaining, "C1", "remaining");
    }

    test_coordinate_based_remove() {
        // replace 'aaa' with ''
        const coord1 = phext.to_coordinate("1.1.1/1.1.1/1.1.1");
        const update1 = phext.remove("aaa\x17bbb\x18ccc\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", coord1);
        assert_eq("R1", update1, "\x17bbb\x18ccc\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "remove aaa");

        // replace 'bbb' with ''
        const coord2 = phext.to_coordinate("1.1.1/1.1.1/1.1.2");
        const update2 = phext.remove(update1, coord2);
        assert_eq("R2", update2, "\x18ccc\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "remove bbb");

        // replace 'ccc' with ''
        const coord3 = phext.to_coordinate("1.1.1/1.1.1/1.2.1");
        const update3 = phext.remove(update2, coord3);
        assert_eq("R3", update3, "\x19ddd\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "remove ccc");

        // replace 'ddd' with ''
        const coord4 = phext.to_coordinate("1.1.1/1.1.1/2.1.1");
        const update4 = phext.remove(update3, coord4);
        assert_eq("R4", update4, "\x1Aeee\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "remove ddd");

        // replace 'eee' with ''
        const coord5 = phext.to_coordinate("1.1.1/1.1.2/1.1.1");
        const update5 = phext.remove(update4, coord5);
        assert_eq("R5", update5, "\x1Cfff\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "remove eee");

        // replace 'fff' with ''
        const coord6 = phext.to_coordinate("1.1.1/1.2.1/1.1.1");
        const update6 = phext.remove(update5, coord6);
        assert_eq("R6", update6, "\x1Dggg\x1Ehhh\x1Fiii\x01jjj", "remove fff");

        // replace 'ggg' with ''
        const coord7 = phext.to_coordinate("1.1.1/2.1.1/1.1.1");
        const update7 = phext.remove(update6, coord7);
        assert_eq("R7", update7, "\x1Ehhh\x1Fiii\x01jjj", "remove ggg");

        // replace 'hhh' with ''
        const coord8 = phext.to_coordinate("1.1.2/1.1.1/1.1.1");
        const update8 = phext.remove(update7, coord8);
        assert_eq("R8", update8, "\x1Fiii\x01jjj", "remove hhh");

        // replace 'iii' with ''
        const coord9 = phext.to_coordinate("1.2.1/1.1.1/1.1.1");
        const update9 = phext.remove(update8, coord9);
        assert_eq("R9", update9, "\x01jjj", "remove iii");

        // replace 'jjj' with ''
        const coord10 = phext.to_coordinate("2.1.1/1.1.1/1.1.1");
        const update10 = phext.remove(update9, coord10);
        assert_eq("R10", update10, "", "remove jjj");
    };

    test_range_based_replace = () => {
        const doc1 = "Before\x19text to be replaced\x1Calso this\x1Dand this\x17After";
        const range1 = phext.create_range(phext.to_coordinate("1.1.1/1.1.1/2.1.1"),
                                   phext.to_coordinate("1.1.1/2.1.1/1.1.1"));
        const update1 = phext.range_replace(doc1, range1, "");
        assert_eq("RBR1", update1, "Before\x19\x17After", "multiple scrolls");

        const doc2 = "Before\x01Library two\x01Library three\x01Library four";
        const range2 = phext.create_range(phext.to_coordinate("2.1.1/1.1.1/1.1.1"),
                                   phext.to_coordinate("3.1.1/1.1.1/1.1.1"));

        const update2 = phext.range_replace(doc2, range2, "");
        assert_eq("RBR2", update2, "Before\x01\x01Library four", "another case");
    };

    test_dead_reckoning() {
        var test = "";
        test += "random text in 1.1.1/1.1.1/1.1.1 that we can skip past";
        test += phext.LIBRARY_BREAK;
        test += "everything in here is at 2.1.1/1.1.1/1.1.1";
        test += phext.SCROLL_BREAK;
        test += "and now we're at 2.1.1/1.1.1/1.1.2";
        test += phext.SCROLL_BREAK;
        test += "moving on up to 2.1.1/1.1.1/1.1.3";
        test += phext.BOOK_BREAK;
        test += "and now over to 2.1.1/1.1.2/1.1.1";
        test += phext.SHELF_BREAK;
        test += "woot, up to 2.2.1/1.1.1/1.1.1";
        test += phext.LIBRARY_BREAK;
        test += "here we are at 3.1.1/1.1.1.1.1";
        test += phext.LIBRARY_BREAK; // 4.1.1/1.1.1/1.1.1
        test += phext.LIBRARY_BREAK; // 5.1.1/1.1.1/1.1.1
        test += "getting closer to our target now 5.1.1/1.1.1/1.1.1";
        test += phext.SHELF_BREAK; // 5.2.1
        test += phext.SHELF_BREAK; // 5.3.1
        test += phext.SHELF_BREAK; // 5.4.1
        test += phext.SHELF_BREAK; // 5.5.1
        test += phext.SERIES_BREAK; // 5.5.2
        test += phext.SERIES_BREAK; // 5.5.3
        test += phext.SERIES_BREAK; // 5.5.4
        test += phext.SERIES_BREAK; // 5.5.5
        test += "here we go! 5.5.5/1.1.1/1.1.1";
        test += phext.COLLECTION_BREAK; // 5.5.5/2.1.1/1.1.1
        test += phext.COLLECTION_BREAK; // 5.5.5/3.1.1/1.1.1
        test += phext.COLLECTION_BREAK; // 5.5.5/4.1.1/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.1.2/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.1.3/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.1.4/1.1.1
        test += "this test appears at 5.5.5/4.1.4/1.1.1";
        test += phext.VOLUME_BREAK; // 5.5.5/4.2.1/1.1.1
        test += phext.VOLUME_BREAK; // 5.5.5/4.3.1/1.1.1
        test += phext.VOLUME_BREAK; // 5.5.5/4.4.1/1.1.1
        test += phext.VOLUME_BREAK; // 5.5.5/4.5.1/1.1.1
        test += phext.VOLUME_BREAK; // 5.5.5/4.6.1/1.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.1/2.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.1/3.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.1/4.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.1/5.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.6.2/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.6.3/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.6.4/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.6.5/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.6.6/1.1.1
        test += phext.BOOK_BREAK; // 5.5.5/4.6.7/1.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/2.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/3.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/4.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/5.1.1
        test += phext.SCROLL_BREAK; // 5.5.5/4.6.7/5.1.2
        test += phext.SCROLL_BREAK; // 5.5.5/4.6.7/5.1.3
        test += phext.SCROLL_BREAK; // 5.5.5/4.6.7/5.1.4
        test += phext.SCROLL_BREAK; // 5.5.5/4.6.7/5.1.5
        test += phext.SCROLL_BREAK; // 5.5.5/4.6.7/5.1.6
        test += "here's a test at 5.5.5/4.6.7/5.1.6";
        test += phext.SCROLL_BREAK; // 5.5.5/4.6.7/5.1.7
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/6.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/7.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/8.1.1
        test += phext.CHAPTER_BREAK; // 5.5.5/4.6.7/9.1.1
        test += phext.SECTION_BREAK; // 5.5.5/4.6.7/9.2.1
        test += phext.SECTION_BREAK; // 5.5.5/4.6.7/9.3.1
        test += phext.SECTION_BREAK; // 5.5.5/4.6.7/9.4.1
        test += phext.SECTION_BREAK; // 5.5.5/4.6.7/9.5.1
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.2
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.3
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.4
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.5
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.6
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.7
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.8
        test += phext.SCROLL_BREAK;  // 5.5.5/4.6.7/9.5.9
        test += "Expected Test Pattern Alpha Whisky Tango Foxtrot";
        const coord = phext.to_coordinate("5.5.5/4.6.7/9.5.9");
        const result = phext.fetch(test, coord);
        assert_eq("DR1", result, "Expected Test Pattern Alpha Whisky Tango Foxtrot", "chosen scroll");

        const coord2 = phext.to_coordinate("5.5.5/4.6.7/5.1.6");
        const result2 = phext.fetch(test, coord2);
        assert_eq("DR2", result2, "here's a test at 5.5.5/4.6.7/5.1.6", "second scroll test");
    };

    test_line_break = () => {
        assert_eq("LB1", phext.LINE_BREAK, '\n', "Backwards compatibility with plain text");
    };

    test_more_cowbell = () => {
        const test1 = phext.check_for_cowbell("Hello\x07");
        const test2 = phext.check_for_cowbell("nope\x17just more scrolls");
        assert_eq("MC1", phext.MORE_COWBELL, '\x07', "ASCII Fun");
        assert_true("MC2", test1, "Expect Passed");
        assert_false("MC3", test2, "Expect Failed");
    };

    test_phokenize = () => {
        const doc1 = "one\x17two\x17three\x17four";
        var expected1 = new Array();
        expected1.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.1"), "one"));
        expected1.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.2"), "two"));
        expected1.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.3"), "three"));
        expected1.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.4"), "four"));
        const update1 = phext.phokenize(doc1);
        assert_number_eq("PH1.1", update1.length, expected1.length, "Positioned Scroll 1");
        for (var i = 0; i < expected1.length; ++i)
        {
            assert_eq(`PH1.2-${i}`, update1[i].scroll, expected1[i].scroll, `Contents 1-${i}`);
            assert_eq(`PH1.3-${i}`, update1[i].coord.to_string(), expected1[i].coord.to_string(), `Coordinates 1-${i}`);
        }

        const doc2 = "one\x01two\x1Fthree\x1Efour\x1Dfive\x1Csix\x1Aseven\x19eight\x18nine\x17ten";
        var expected2 = new Array();
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.1"), "one"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.1.1/1.1.1/1.1.1"), "two"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.1/1.1.1/1.1.1"), "three"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/1.1.1/1.1.1"), "four"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/2.1.1/1.1.1"), "five"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/2.2.1/1.1.1"), "six"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/2.2.2/1.1.1"), "seven"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/2.2.2/2.1.1"), "eight"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/2.2.2/2.2.1"), "nine"));
        expected2.push(phext.create_positioned_scroll(phext.to_coordinate("2.2.2/2.2.2/2.2.2"), "ten"));
        const update2 = phext.phokenize(doc2);
        assert_number_eq("PH2.1", update2.length, expected2.length, "Positioned Scroll 2");
        for (var i = 0; i < expected2.length; ++i)
        {
            assert_eq("PH2.2", update2[i].scroll, expected2[i].scroll, "Contents 2");
            assert_eq("PH2.3", update2[i].coord.to_string(), expected2[i].coord.to_string(), "Coordinates 2");
        }

        const doc3 = "one\x17two\x18three\x19four\x1afive\x1csix\x1dseven\x1eeight\x1fnine\x01ten";
        var expected3 = new Array();
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.1"), "one"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.1.2"), "two"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/1.2.1"), "three"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.1/2.1.1"), "four"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.1.2/1.1.1"), "five"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/1.2.1/1.1.1"), "six"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.1/2.1.1/1.1.1"), "seven"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.1.2/1.1.1/1.1.1"), "eight"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("1.2.1/1.1.1/1.1.1"), "nine"));
        expected3.push(phext.create_positioned_scroll(phext.to_coordinate("2.1.1/1.1.1/1.1.1"), "ten"));
        var update3 = phext.phokenize(doc3);
        assert_number_eq("PH3.1", update3.length, expected3.length, "Positioned Scroll 3");
        for (var i = 0; i < expected3.length; ++i)
        {
            assert_eq("PH3.2", update3[i].scroll, expected3[i].scroll, "Contents 3");
            assert_eq("PH3.3", update3[i].coord.to_string(), expected3[i].coord.to_string(), "Coordinates 3");
        }

        const doc4 = "\x1A\x1C\x1D\x1E\x1F\x01stuff here";
        var expected4 = new Array();
        expected4.push(phext.create_positioned_scroll(phext.to_coordinate("2.1.1/1.1.1/1.1.1"), "stuff here"));
        const update4 = phext.phokenize(doc4);
        assert_number_eq("PH4.1", update4.length, expected4.length, "Positioned Scroll 4");
        for (var i = 0; i < expected4.length; ++i)
        {
            assert_eq("PH4.2", update4[i].scroll, expected4[i].scroll, "Contents 4");
            assert_eq("PH4.3", update4[i].coord.to_string(), expected4[i].coord.to_string(), "Coordinates 4");
        }
    };

    test_merge = () => {
        const doc_1a = "3A\x17B2";
        const doc_1b = "4C\x17D1";
        const update_1 = phext.merge(doc_1a, doc_1b);
        assert_eq("M1", update_1, "3A4C\x17B2D1", "Merge Case 1");

        const doc_2a = "Hello \x17I've come to talk";
        const doc_2b = "Darkness, my old friend.\x17 with you again.";
        const update_2 = phext.merge(doc_2a, doc_2b);
        assert_eq("M2", update_2, "Hello Darkness, my old friend.\x17I've come to talk with you again.", "pre-merge");

        const doc_3a = "One\x17Two\x18Three\x19Four";
        const doc_3b = "1\x172\x183\x194";
        const update_3 = phext.merge(doc_3a, doc_3b);
        assert_eq("M3", update_3, "One1\x17Two2\x18Three3\x19Four4", "4D merge");

        const doc_4a = "\x1A\x1C\x1D\x1E\x1F\x01stuff here";
        const doc_4b = "\x1A\x1C\x1D\x1Eprecursor here\x1F\x01and more";
        const update_4 = phext.merge(doc_4a, doc_4b);
        assert_eq("M4", update_4, "\x1Eprecursor here\x01stuff hereand more", "8D merge");

        const doc_5a = "\x01\x01 Library at 3.1.1/1.1.1/1.1.1 \x1F Shelf at 3.2.1/1.1.1/1.1.1";
        const doc_5b = "\x01\x01\x01 Library 4.1.1/1.1.1/1.1.1 \x1E Series at 4.1.2/1.1.1/1.1.1";
        const update_5 = phext.merge(doc_5a, doc_5b);
        assert_eq("M5", update_5, "\x01\x01 Library at 3.1.1/1.1.1/1.1.1 \x1F Shelf at 3.2.1/1.1.1/1.1.1\x01 Library 4.1.1/1.1.1/1.1.1 \x1E Series at 4.1.2/1.1.1/1.1.1", "Library+Shelf");

        const doc_6a = "\x1D Collection at 1.1.1/2.1.1/1.1.1\x1C Volume at 1.1.1/2.2.1/1.1.1";
        const doc_6b = "\x1D\x1D Collection at 1.1.1/3.1.1/1.1.1\x1C Volume at 1.1.1/3.2.1/1.1.1";
        const update_6 = phext.merge(doc_6a, doc_6b);
        assert_eq("M6", update_6, "\x1D Collection at 1.1.1/2.1.1/1.1.1\x1C Volume at 1.1.1/2.2.1/1.1.1\x1D Collection at 1.1.1/3.1.1/1.1.1\x1C Volume at 1.1.1/3.2.1/1.1.1", "Collection+Volume");

        const doc_7a = "\x1ABook #2 Part 1\x1ABook #3 Part 1";
        const doc_7b = "\x1A + Part II\x1A + Part Deux";
        const update_7 = phext.merge(doc_7a, doc_7b);
        assert_eq("M7", update_7, "\x1ABook #2 Part 1 + Part II\x1ABook #3 Part 1 + Part Deux", "Books");

        const doc8a = "AA\x01BB\x01CC";
        const doc8b = "__\x01__\x01__";
        const update8 = phext.merge(doc8a, doc8b);
        assert_eq("M8", update8, "AA__\x01BB__\x01CC__", "More libraries");
    };

    test_subtract = () => {
        const doc1a = "Here's scroll one.\x17Scroll two.";
        const doc1b = "Just content at the first scroll";
        const update1 = phext.subtract(doc1a, doc1b);
        assert_eq("SUB1", update1, "\x17Scroll two.", "Basic scrubbing");
    };

    test_normalize = () => {
        const doc1 = "\x17Scroll two\x18\x18\x18\x18";
        const update1 = phext.normalize(doc1);
        assert_eq("N1", update1, "\x17Scroll two", "Pruning empty ranges");

        const doc2 = "\x17Scroll two\x01\x17\x17\x19\x1a\x01Third library";
        const update2 = phext.normalize(doc2);
        assert_eq("N2", update2, "\x17Scroll two\x01\x01Third library");
    };

    test_expand = () => {
        const doc1 = "nothing but line breaks\nto test expansion to scrolls\nline 3";
        const update1 = phext.expand(doc1);
        assert_eq("E1", update1, "nothing but line breaks\x17to test expansion to scrolls\x17line 3", "LB -> SC");

        const update2 = phext.expand(update1);
        assert_eq("E2", update2, "nothing but line breaks\x18to test expansion to scrolls\x18line 3", "SC -> SN");

        const update3 = phext.expand(update2);
        assert_eq("E3", update3, "nothing but line breaks\x19to test expansion to scrolls\x19line 3", "SN -> CH");

        const update4 = phext.expand(update3);
        assert_eq("E4", update4, "nothing but line breaks\x1Ato test expansion to scrolls\x1Aline 3", "CH -> BK");

        const update5 = phext.expand(update4);
        assert_eq("E5", update5, "nothing but line breaks\x1Cto test expansion to scrolls\x1Cline 3", "BK -> VM");

        const update6 = phext.expand(update5);
        assert_eq("E6", update6, "nothing but line breaks\x1Dto test expansion to scrolls\x1Dline 3", "VM -> CN");

        const update7 = phext.expand(update6);
        assert_eq("E7", update7, "nothing but line breaks\x1Eto test expansion to scrolls\x1Eline 3", "CN -> SR");

        const update8 = phext.expand(update7);
        assert_eq("E8", update8, "nothing but line breaks\x1Fto test expansion to scrolls\x1Fline 3", "SR -> SF");

        const update9 = phext.expand(update8);
        assert_eq("E9", update9, "nothing but line breaks\x01to test expansion to scrolls\x01line 3", "SF -> LB");

        const update10 = phext.expand(update9);
        assert_eq("E10", update10, "nothing but line breaks\x01to test expansion to scrolls\x01line 3", "LB -> LB");

        const doc11 = "AAA\n222\x17BBB\x18CCC\x19DDD\x1AEEE\x1CFFF\x1DGGG\x1EHHH\x1FIII\x01JJJ";
        const update11 = phext.expand(doc11);
        assert_eq("E11", update11, "AAA\x17222\x18BBB\x19CCC\x1ADDD\x1CEEE\x1DFFF\x1EGGG\x1FHHH\x01III\x01JJJ", "all at once");
    };

    test_contract = () => {
        const doc1 = "A more complex example than expand\x01----\x1F++++\x1E____\x1Doooo\x1C====\x1Azzzz\x19gggg\x18....\x17qqqq";
        const update1 = phext.contract(doc1);
        assert_eq("C1", update1, "A more complex example than expand\x1F----\x1E++++\x1D____\x1Coooo\x1A====\x19zzzz\x18gggg\x17....\x0Aqqqq", "drop back");

        const update2 = phext.contract(update1);
        assert_eq("C2", update2, "A more complex example than expand\x1E----\x1D++++\x1C____\x1Aoooo\x19====\x18zzzz\x17gggg\x0A....\x0Aqqqq", "another sanity check");
    };

    test_fs_read_write = () => {        
        const filename = "unit-test.phext";
        const initial = "a simple phext doc with three scrolls\x17we just want to verify\x17that all of our breaks are making it through rust's fs layer.\x18section 2\x19chapter 2\x1Abook 2\x1Cvolume 2\x1Dcollection 2\x1Eseries 2\x1Fshelf 2\x01library 2";
        fs.writeFileSync(filename, initial);

        const compare = fs.readFileSync(filename);
        assert_eq("FS1", compare.toString(), initial, "serialization");
    };

    test_replace_create = () => {
        const initial = "A\x17B\x17C\x18D\x19E\x1AF\x1CG\x1DH\x1EI\x1FJ\x01K";
        const coordinate = "3.1.1/1.1.1/1.1.1";
        const message = phext.replace(initial, phext.to_coordinate(coordinate), "L");
        assert_eq("RC1", message, "A\x17B\x17C\x18D\x19E\x1AF\x1CG\x1DH\x1EI\x1FJ\x01K\x01L", "Create + Replace");
    };

    test_summary() {
        const doc1 = "A short phext\nSecond line\x17second scroll.............................";
        const update1 = phext.create_summary(doc1);
        assert_eq("SU1", update1, "A short phext...", "Terse!");

        const doc2 = "very terse";
        const update2 = phext.create_summary(doc2);
        assert_eq("SU2", update2, "very terse", "much wow");
    };

    test_navmap = () => {
        const example = "Just a couple of scrolls.\x17Second scroll\x17Third scroll";
        const result = phext.navmap("http://127.0.0.1/api/v1/index/", example);
        assert_eq("NM1", result, "<ul>\n<li><a href=\"http://127.0.0.1/api/v1/index/1.1.1;1.1.1;1.1.1\">1.1.1/1.1.1/1.1.1 Just a couple of scrolls.</a></li>\n<li><a href=\"http://127.0.0.1/api/v1/index/1.1.1;1.1.1;1.1.2\">1.1.1/1.1.1/1.1.2 Second scroll</a></li>\n<li><a href=\"http://127.0.0.1/api/v1/index/1.1.1;1.1.1;1.1.3\">1.1.1/1.1.1/1.1.3 Third scroll</a></li>\n</ul>\n", "HTML Navigation Menu");
    };

    test_textmap = () => {
        const example = "Just a couple of scrolls.\x17Second scroll\x17Third scroll";
        const result = phext.textmap(example);
        assert_eq("TM1", result, "* 1.1.1/1.1.1/1.1.1: Just a couple of scrolls.\n* 1.1.1/1.1.1/1.1.2: Second scroll\n* 1.1.1/1.1.1/1.1.3: Third scroll\n", "Text-only navigation map");
    };

    test_phext_index = () => {
        const example = "first scroll\x17second scroll\x18second section\x19second chapter\x1Abook 2\x1Cvolume 2\x1Dcollection 2\x1Eseries 2\x1Fshelf 2\x01library 2";
        const result = phext.index(example);
        assert_eq("PI1", result, "0\x1713\x1827\x1942\x1a57\x1c64\x1d73\x1e86\x1f95\x01103", "offset calculation");

        const coord1 = phext.to_coordinate("1.1.1/1.1.1/1.1.1");
        const test1 = phext.offset(example, coord1);
        assert_number_eq("PI2", test1, 0, "offset verification");

        const coord2 = phext.to_coordinate("1.1.1/1.1.1/1.1.2");
        const test2 = phext.offset(example, coord2);
        assert_number_eq("PI3", test2, 13, "offset verification");

        const coord3 = phext.to_coordinate("1.1.1/1.1.1/1.2.1");
        const test3 = phext.offset(example, coord3);
        assert_number_eq("PI4", test3, 27, "offset verification");

        const coord4 = phext.to_coordinate("1.1.1/1.1.1/2.1.1");
        const test4 = phext.offset(example, coord4);
        assert_number_eq("PI5", test4, 42, "offset verification");

        const coord5 = phext.to_coordinate("1.1.1/1.1.2/1.1.1");
        const test5 = phext.offset(example, coord5);
        assert_number_eq("PI6", test5, 57, "offset verification");

        const coord6 = phext.to_coordinate("1.1.1/1.2.1/1.1.1");
        const test6 = phext.offset(example, coord6);
        assert_number_eq("PI7", test6, 64, "offset verification");

        const coord7 = phext.to_coordinate("1.1.1/2.1.1/1.1.1");
        const test7 = phext.offset(example, coord7);
        assert_number_eq("PI8", test7, 73, "offset verification");

        const coord8 = phext.to_coordinate("1.1.2/1.1.1/1.1.1");
        const test8 = phext.offset(example, coord8);
        assert_number_eq("PI9", test8, 86, "offset verification");

        const coord9 = phext.to_coordinate("1.2.1/1.1.1/1.1.1");
        const test9 = phext.offset(example, coord9);
        assert_number_eq("PI10", test9, 95, "offset verification");

        const coord10 = phext.to_coordinate("2.1.1/1.1.1/1.1.1");
        const test10 = phext.offset(example, coord10);
        assert_number_eq("PI11", test10, 103, "offset verification");

        const coord_invalid = phext.to_coordinate("2.1.1/1.1.1/1.2.1");
        const test_invalid = phext.offset(example, coord_invalid);
        assert_number_eq("PI12", test_invalid, 103);

        assert_number_eq("PI13", example.length, 112);
    };

    // holding off on checksums until xxh3 is patched to match v0.8.2
        /*
    test_scroll_manifest = () => {
        const example = "first scroll\x17second scroll\x18second section\x19second chapter\x1Abook 2\x1Cvolume 2\x1Dcollection 2\x1Eseries 2\x1Fshelf 2\x01library 2";
        const result = phext.manifest(example);

        const scroll0 = "00000000000000000000";
        const hash0 = phext.checksum(scroll0);
        assert_eq("SM0", hash0, "7e79edd92a62a048e1cd24ffab542e34", "hash verification");

        const scroll1 = "first scroll";
        const hash1 = phext.checksum(scroll1);
        assert_eq("SM1", hash1, "ba9d944e4967e29d48bae69ac2999699", "hash verification");

        const scroll2 = "second scroll";
        const hash2 = phext.checksum(scroll2);
        assert_eq("SM2", hash2, "2fe1b2040314ac66f132dd3b4926157c", "hash verification");

        const scroll3 = "second section";
        const hash3 = phext.checksum(scroll3);
        assert_eq("SM3", hash3, "fddb6916753b6f4e0b5281469134778b", "hash verification");

        const scroll4 = "second chapter";
        const hash4 = phext.checksum(scroll4);
        assert_eq("SM4", hash4, "16ab5b1a0a997db95ec215a3bf2c57b3", "hash verification");

        const scroll5 = "book 2";
        const hash5 = phext.checksum(scroll5);
        assert_eq("SM5", hash5, "0f20f79bf36f63e8fba25cc6765e2d0d", "hash verification");

        const scroll6 = "volume 2";
        const hash6 = phext.checksum(scroll6);
        assert_eq("SM6", hash6, "7ead0c6fef43adb446fe3bda6fb0adc7", "hash verification");

        const scroll7 = "collection 2";
        const hash7 = phext.checksum(scroll7);
        assert_eq("SM7", hash7, "78c12298931c6edede92962137a9280a", "hash verification");

        const scroll8 = "series 2";
        const hash8 = phext.checksum(scroll8);
        assert_eq("SM8", hash8, "0f35100c84df601a490b7b63d7e8c0a8", "hash verification");

        const scroll9 = "shelf 2";
        const hash9 = phext.checksum(scroll9);
        assert_eq("SM9", hash9, "3bbf7e67cb33d613a906bc5a3cbefd95", "hash verification");

        const scroll10 = "library 2";
        const hash10 = phext.checksum(scroll10);
        assert_eq("SM10", hash10, "2e7fdd387196a8a2706ccb9ad6792bc3", "hash verification");

        const expected = `${hash1}\x17${hash2}\x18${hash3}\x19${hash4}\x1A${hash5}\x1C${hash6}\x1D${hash7}\x1E${hash8}\x1F${hash9}\x01${hash10}`;
        assert_eq("SM11", result, expected, "Hierarchical Hash");
    };*/

    test_phext_soundex_v1 = () => {
        const letters1 = "bpfv";
        const precheck1 = phext.soundex_internal(letters1);
        assert_number_eq("PSP1", precheck1, 5, "1 + the 1-values");

		const letters2 = "cskgjqxz";
        const precheck2 = phext.soundex_internal(letters2);
        assert_number_eq("PSP2", precheck2, 17, "1 + the 2-values");

		const letters3 = "dt";
        const precheck3 = phext.soundex_internal(letters3);
        assert_number_eq("PSP3", precheck3, 7, "1 + the 3-values");

		const letters4 = "l";
        const precheck4 = phext.soundex_internal(letters4);
        assert_number_eq("PSP4", precheck4, 5, "1 + the 4-values");

		const letters5 = "mn";
        const precheck5 = phext.soundex_internal(letters5);
        assert_number_eq("PSP5", precheck5, 11, "1 + the 5-values");

		const letters6 = "r";
        const precheck6 = phext.soundex_internal(letters6);
        assert_number_eq("PSP6", precheck6, 7, "1 + the 6-values");
        
        const sample = "it was the best of scrolls\x17it was the worst of scrolls\x17aaa\x17bbb\x17ccc\x17ddd\x17eee\x17fff\x17ggg\x17hhh\x17iii\x17jjj\x17kkk\x17lll\x18mmm\x18nnn\x18ooo\x18ppp\x19qqq\x19rrr\x19sss\x19ttt\x1auuu\x1avvv\x1awww\x1axxx\x1ayyy\x1azzz";
        const result = phext.soundex_v1(sample);
        assert_eq("PSV1", result, "36\x1741\x171\x174\x177\x1710\x171\x174\x177\x171\x171\x177\x177\x1713\x1816\x1816\x181\x184\x197\x1919\x197\x1910\x1a1\x1a4\x1a1\x1a7\x1a1\x1a7", "Soundex");
    };
}
var runner = new Tests();
runner.run();
const result = failed == 0 ? "Success" : "Failure";
console.log(`Result: ${result} (${passed} passed ${failed} failed)`);