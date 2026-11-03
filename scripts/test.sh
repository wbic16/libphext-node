#!/usr/bin/env bash
# libphext-node: run the test-app harness against THIS checkout's src.
#
# There is no unit-test runner in this repo (`npm test` is the default
# "no test specified" stub). The real harness is test-app/index.ts:
# ~217 assertions that print "Result: Success (N passed 0 failed)".
#
# This script reproduces the harness run from a clean clone:
#   1. Compiles src/index.ts (+ type declarations) with the repo's
#      TypeScript into a scratch dir, as a `libphext` package.
#   2. Copies test-app/index.ts and test-app/unit-test.phext (the harness
#      reads that file from its working directory) into the scratch dir
#      and compiles the harness there, so `import "libphext"` resolves
#      to the just-compiled library — never to a published copy.
#   3. Runs the compiled harness under node and checks its Result line.
#      (The harness itself always exits 0, so this script parses the
#      Result line and fails if it is not Success.)
#
# The scratch dir is removed on exit. The repo tree is not modified,
# except that `npm install` runs first if dependencies are missing.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"

if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/vite ]; then
  echo "dependencies missing — running npm install"
  npm install
fi
TSC="$REPO/node_modules/.bin/tsc"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
APP="$WORK/app"
mkdir -p "$APP/node_modules/libphext"

# tsconfig.build.json carries the flags — including the "paths" mapping that
# points 'xxh3-ts' at src/xxh3-ts.d.ts (the package's own shipped .ts sources
# no longer compile under TS >= 5.7; see that file's header).
"$TSC" -p tsconfig.build.json --outDir "$APP/node_modules/libphext"
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)"
printf '{"name":"libphext","version":"%s","type":"module","main":"index.js","types":"index.d.ts","exports":{".":"./index.js"}}' "$VERSION" \
  > "$APP/node_modules/libphext/package.json"

# The library's runtime dependencies must resolve inside the scratch app:
# node module resolution walks up from node_modules/libphext, so link them
# in from the repo's install. ('buffer' needs no link — it is a node core
# module; xxh3-ts is a real package.)
for dep in xxh3-ts; do
  if [ -d "$REPO/node_modules/$dep" ]; then
    ln -s "$REPO/node_modules/$dep" "$APP/node_modules/$dep"
  fi
done

cp test-app/index.ts test-app/unit-test.phext "$APP/"
( cd "$APP" && "$TSC" index.ts --target ES2020 --module ES2020 \
    --moduleResolution node --skipLibCheck --types node \
    --typeRoots "$REPO/node_modules/@types" )

OUT="$(cd "$APP" && node index.js)"
echo "$OUT" | tail -5
RESULT_LINE="$(echo "$OUT" | grep '^Result: ' || true)"
if echo "$RESULT_LINE" | grep -q '^Result: Success ('; then
  echo "test.sh: $RESULT_LINE"
else
  echo "test.sh: harness did not report Success: ${RESULT_LINE:-<no Result line>}" >&2
  exit 1
fi
