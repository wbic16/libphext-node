libphext for node.js
--------------------
This project is a fork of https://github.com/wbic16/libphext-rs.

It generally lags behind the Rust implementation a bit, but should be very close in terms of functionality.

Current Library Release: v0.6.1
Port: Complete

Coordinates (since 0.4.0)
-------------------------
Coordinate components are unbounded: any component >= 1 is valid, and walking
breaks advances components past 999 (1000, 1001, ...) instead of saturating.

Precision limit: components are JS numbers, so the largest component that is
exactly representable is `MAX_COMPONENT = Number.MAX_SAFE_INTEGER`
(9007199254740991, exported from the package and available as
`phext.MAX_COMPONENT`). Parsing or advancing past it throws an error instead
of silently rounding — 9007199254740993 would otherwise become
9007199254740992 and address the wrong scroll. (libphext-rs, with u64/usize
components, has no such limit; this is a JS-representation bound, not a
format bound.)

No phext coordinate component can ever be less than 1 (Will's ruling,
2026-11-02): coordinates are 1-based by definition. Every parse and compute
path — the `Coordinate` constructor, `Phext.to_coordinate`, and all advance
paths — funnels components through one sanitizer, so a NaN / non-numeric /
empty component wraps to 1, and so does an explicit 0
(`new Coordinate("HOME")` and `to_coordinate("0.0.0/0.0.0/0.0.0")` are both
`1.1.1/1.1.1/1.1.1`). There is no "null coordinate". Until this ruling,
`to_coordinate` mirrored libphext-rs in preserving explicit 0 components as
an invalid null coordinate; that exception is removed.

Dense graphs: phext is sparse by design. Coordinate components are unbounded,
but a fully-populated dense graph contains the product of its dimensions'
extents in scrolls — a dense block spanning 1000 in each of 9 dimensions
implies 10^27 scrolls. Materializing, exploding, or indexing such a graph
costs memory proportional to its populated scroll count. The old 999 cap
never protected against this (999^9 was already unreachable); sparsity does.
Keep graphs sparse.
Checksum / Manifest
-------------------
`phext.checksum(text)` returns the XXH3-128 hash of the text's UTF-8 bytes
as 32 lowercase hex characters, byte-identical to libphext-rs
(xxhash-rust). `phext.manifest(doc)` replaces every scroll in a document
with its checksum. The implementation is xxh3-ts, a pure-TypeScript port
(no native code) verified against the Rust build on every XXH3 length
class, multi-KB inputs, and unicode text.

Explode / Implode
-----------------
`phext.explode(doc)` returns a `Map<string, string>` from canonical
coordinate strings (`"1.1.1/1.1.1/1.1.1"`) to scroll text;
`phext.implode(map)` serializes such a map back into a phext document
(entries are sorted by coordinate; empty scrolls are dropped). These mirror
libphext-rs's `explode`/`implode` — rs keys its HashMap by `Coordinate`,
while JS keys this Map by the coordinate's canonical string
(`Coordinate.to_string()` produces it, `new Coordinate(key)` parses it
back). `implode(explode(doc))` is the identity on any phext document.

Offsets
-------
`index()` and `offset()` report **UTF-8 byte offsets**, matching
libphext-rs. (JS string length counts UTF-16 code units; on non-ASCII
scrolls the two diverge — for "héllo\x17wörld" the second scroll sits at
byte offset 7, not 6.)

Binary scrolls (since 0.5.0, in 0.6.0 here)
-------------------------------------------
Arbitrary bytes ride inside a phext as a canonical binary scroll: the
header line `phext-binary:1:base64` plus the payload as strict RFC 4648
base64 (exported as `BINARY_SCROLL_HEADER`). `phext.encode_scroll(bytes)` /
`phext.decode_scroll(scroll)` convert directly; `insert_binary` /
`replace_binary` / `fetch_binary` work on documents. The byte-oriented
`insert_bytes` / `replace_bytes` / `ingest` entry points apply the
canonical ingestion rule — valid UTF-8 is stored as ordinary text,
anything else is stored as a binary scroll holding the base64 of the
exact observed bytes, verbatim — so a matching `fetch_binary` returns
the original bytes exactly. `phokenize_bytes(data)` is the byte-level
twin of `phokenize`. All of this mirrors libphext-rs `binary` byte-for-byte.

The xz seal (since 0.5.0, in 0.6.0 here)
----------------------------------------
A finished phext may be sealed: xz-compressed as a whole, at preset 6
with the CRC64 check (liblzma via the `lzma-native` binding) — the same
encoder settings as libphext-rs, so sealed bytes are byte-identical
across implementations, and any standard xz decoder unseals them.
`phext.seal(text)` / `seal_bytes(data)` / `unseal(data)` /
`unseal_string(data)` mirror rs's `seal` module, with one call-shape
difference: lzma-native's API is promise-based (it has no synchronous
entry point), so these return `Promise<Buffer>` / `Promise<string>`
where Rust returns values. The seal is Node-only (a native addon cannot
bundle for the browser); the rest of the library is unchanged.

Chains (since 0.6.0)
--------------------
Above the library break sits the stream level: whole phexts joined into
chains by the chain break (0x02, `phext.CHAIN_BREAK`) and terminated by
the chain close (0x03, `phext.CHAIN_CLOSE`). `phext.parse_chains(stream)`
returns `Chain` objects (`members`, `closed`); `phext.serialize_chains`
is its byte-exact inverse for every stream, including empty members and
unclosed chains at EOF. Inside a chain, members are universes indexed
from 1: `chain.fetch("$2:1.1.1/1.1.1/1.1.1")` fetches a scroll from
universe 2, a bare address means universe 1, and misses return `""`.
`phext.parse_universe_address(address)` exposes the address parse.
Conformance is pinned by the shared fixture set in `tests/fixtures/`
(10 chain cases, 42 fetches, generated by libphext-rs 0.6.0), which the
test harness runs in full.

Development: Test / Build / Publish
-----------------------------------

Prerequisites: Node.js and npm. Run `npm install` once (the scripts do it
for you if `node_modules` is missing).

### Test

1. Run `scripts/test.sh`.
2. There is no unit-test runner in this repo — `npm test` is the default
   "no test specified" stub and is **not** the test suite. The real suite
   is the `test-app/index.ts` harness. `scripts/test.sh`
   compiles `src/index.ts` with the repo's TypeScript into a scratch dir
   as a `libphext` package, compiles the harness against it there, runs
   it under node, and passes only if the harness prints
   `Result: Success (N passed 0 failed)`. Expected at 0.6.0: **32415
   passed** — the bulk of the count is the shared chain-fixture suite
   checking every scroll digest of two real corpora (CYOA + agi.phext,
   ~10.5k scrolls) plus the binary, chain, and seal suites ported from
   libphext-rs; the pre-0.6 harness accounted for 274 of the assertions.

### Build

1. Run `scripts/build.sh` — this runs `npx vite build`, producing the ES
   and UMD bundles in `dist/`, then a declaration-only `tsc` pass that emits
   `dist/index.d.ts`. The published tarball ships the typings:
   `package.json`'s `types` (and the `exports` types condition) point at
   `dist/index.d.ts`, and `main`/`module` at the real ES bundle,
   `dist/libphext.js`.
2. ⚠️ Do not use `npm run build` (parcel): the parcel build is broken by a
   pre-existing dependency conflict (parcel ^2.12 vs the pinned
   @parcel/transformer-typescript-types 2.8.3). That is a toolchain
   problem, not a source problem; vite is the working build.

### Publish (npm)

Prerequisites: an npm credential — run `npm login` once, or set
`NPM_TOKEN` in your environment (referenced from `~/.npmrc`). Never commit
a token.

1. Set the new version in `package.json`.
2. Run `scripts/publish.sh` with no environment variables. It runs the
   test harness, runs the build, then runs `npm publish --dry-run`,
   prints exactly what would be published (name, version, tarball
   contents), and **stops**. Nothing is published in this step.
3. Review the printed name, version, and tarball contents.
4. Run `PUBLISH_CONFIRM=1 scripts/publish.sh`. This repeats steps 1–3 and
   then runs the real `npm publish`.
