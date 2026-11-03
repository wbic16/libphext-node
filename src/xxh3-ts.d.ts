// Local typings for the 'xxh3-ts' dependency, wired in via the "paths"
// mapping in tsconfig.build.json.
//
// Why: xxh3-ts ships its TypeScript sources next to its .d.ts files, and
// tsc resolves the sources first. Those sources no longer compile under
// TS >= 5.7 (the typed-array generics change), so any compile that imports
// the package fails inside node_modules. These declarations shadow the
// package's own types at build time; at runtime the package's compiled JS
// is used unchanged (paths mappings never rewrite emitted imports).
/// <reference types="node" />
export declare function XXH3_128(data: Buffer, seed?: bigint): bigint;
export declare function XXH64(data: Buffer, seed?: bigint): bigint;
