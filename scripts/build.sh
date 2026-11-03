#!/usr/bin/env bash
# libphext-node: build the distributable bundles into dist/.
#
# Underlying command: npx vite build
#   (vite.config.ts builds src/index.ts as an ES module, dist/libphext.js,
#    plus a UMD bundle.)
#
# ⚠️ Do NOT "fix" this back to `npm run build` / parcel: package.json's
# parcel build is broken by a pre-existing dependency conflict
# (parcel ^2.12 vs the pinned @parcel/transformer-typescript-types 2.8.3).
# vite is the working build; parcel stays broken until someone upgrades
# the parcel toolchain itself, which is a separate job.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x node_modules/.bin/vite ]; then
  echo "dependencies missing — running npm install"
  npm install
fi
npx vite build

# Vite does not emit type declarations, so follow with a declaration-only
# tsc pass into dist/ (same tsconfig.build.json the test harness uses —
# it carries the xxh3-ts paths shim; see src/xxh3-ts.d.ts). package.json's
# "types" points at the resulting dist/index.d.ts, and the "files" field
# already ships all of dist/, so the tarball carries real typings.
if [ ! -x node_modules/.bin/tsc ]; then
  echo "dependencies missing — running npm install"
  npm install
fi
node_modules/.bin/tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist
echo "--- dist/:"
ls -la dist/
