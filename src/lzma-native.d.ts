// Local typings for the 'lzma-native' dependency, wired in via the
// "paths" mapping in tsconfig.build.json.
//
// Why: lzma-native ships no TypeScript declarations at all, so any
// compile that imports the package fails with an implicit-any error
// under this repo's settings. These declarations shadow the package at
// build time (the same pattern as src/xxh3-ts.d.ts); at runtime the
// package's own JS and its prebuilt native binding are used unchanged
// (paths mappings never rewrite emitted imports).
//
// Only the surface libphext uses is declared: the promise form of
// compress/decompress (lzma-native's compress carries a
// util.promisify.custom implementation, so it returns a Promise when
// called without a callback) and the CHECK_* constants.
/// <reference types="node" />
export declare const CHECK_NONE: number;
export declare const CHECK_CRC32: number;
export declare const CHECK_CRC64: number;
export declare const CHECK_SHA256: number;

export interface CompressOptions {
	preset?: number;
	check?: number;
}

export declare function compress(input: Buffer, options?: CompressOptions): Promise<Buffer>;
export declare function decompress(input: Buffer): Promise<Buffer>;
