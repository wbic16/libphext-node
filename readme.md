libphext for node.js
--------------------
This project is a fork of https://github.com/wbic16/libphext-rs.

It generally lags behind the Rust implementation a bit, but should be very close in terms of functionality.

Current Library Release: v0.1.7
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

A computed address never carries NaN: in the `Coordinate` constructor and on
every advance path, a NaN / non-numeric / empty component wraps to 1
(`new Coordinate("HOME")` is `1.1.1/1.1.1/1.1.1`). `Phext.to_coordinate` is
deliberately exempt — it mirrors libphext-rs, where explicit 0 components form
the documented "null coordinate", and its digit-only accumulation cannot
produce NaN.

Dense graphs: phext is sparse by design. Coordinate components are unbounded,
but a fully-populated dense graph contains the product of its dimensions'
extents in scrolls — a dense block spanning 1000 in each of 9 dimensions
implies 10^27 scrolls. Materializing, exploding, or indexing such a graph
costs memory proportional to its populated scroll count. The old 999 cap
never protected against this (999^9 was already unreachable); sparsity does.
Keep graphs sparse.
Offsets
-------
`index()` and `offset()` report **UTF-8 byte offsets**, matching
libphext-rs. (JS string length counts UTF-16 code units; on non-ASCII
scrolls the two diverge — for "héllo\x17wörld" the second scroll sits at
byte offset 7, not 6.)

Development: Test / Build / Publish
-----------------------------------

Prerequisites: Node.js and npm. Run `npm install` once (the scripts do it
for you if `node_modules` is missing).

### Test

1. Run `scripts/test.sh`.
2. There is no unit-test runner in this repo — `npm test` is the default
   "no test specified" stub and is **not** the test suite. The real suite
   is the `test-app/index.ts` harness (~217 assertions). `scripts/test.sh`
   compiles `src/index.ts` with the repo's TypeScript into a scratch dir
   as a `libphext` package, compiles the harness against it there, runs
   it under node, and passes only if the harness prints
   `Result: Success (N passed 0 failed)`. Expected at 0.4.0: **217 passed**.

### Build

1. Run `scripts/build.sh` — this runs `npx vite build`, producing the ES
   and UMD bundles in `dist/`.
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
