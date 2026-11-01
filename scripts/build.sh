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
echo "--- dist/:"
ls -la dist/
