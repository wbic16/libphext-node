#!/usr/bin/env bash
# libphext-node: publish to npm — SAFETY-FIRST.
#
# What this script does:
#   1. Runs the test harness (scripts/test.sh) and the build
#      (scripts/build.sh).
#   2. Runs `npm publish --dry-run` (always — it prints the exact tarball
#      contents and metadata without uploading).
#   3. Prints exactly what would be published (name, version, artifacts).
#   4. STOPS. The real publish runs only when PUBLISH_CONFIRM=1 is set.
#
# Credentials: run `npm login` once beforehand, or set NPM_TOKEN in the
# environment (referenced from ~/.npmrc as
# //registry.npmjs.org/:_authToken=${NPM_TOKEN}). No credential is
# embedded in this script.
#
# Usage:
#   scripts/publish.sh                    # dry-run + summary, then stop
#   PUBLISH_CONFIRM=1 scripts/publish.sh  # dry-run, then publish for real
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="$(sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' package.json | head -1)"
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)"

scripts/test.sh
scripts/build.sh

echo "--- npm publish --dry-run:"
npm publish --dry-run

echo "=================================================="
echo "Ready to publish: ${NAME} v${VERSION} -> npm"
echo "Artifacts: the npm tarball printed above (dist/ bundles, per the"
echo "           package.json \"files\" field)."
if [ "${PUBLISH_CONFIRM:-}" != "1" ]; then
  echo "STOPPED: this was a dry run only. Nothing was published."
  echo "To publish for real:  PUBLISH_CONFIRM=1 scripts/publish.sh"
  exit 0
fi

echo "PUBLISH_CONFIRM=1 set — publishing ${NAME} v${VERSION}..."
npm publish
echo "Published ${NAME} v${VERSION} to npm."
