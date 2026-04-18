#!/usr/bin/env bash
# Package runtime build output into a versioned tarball.
# Run from repo root after `npm run build`.
#
# Outputs (under artifacts/publish/):
#   runtime.tar.gz   – compressed dist/ directory (contains site/ subdir)
#   checksums.txt    – sha256 checksum for the tarball
#
# Note: Vite outputs to dist/site/ (base: '/site/'). We tar from dist/ so the
# tarball preserves the site/ prefix and extracts into hosting/public/site/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RUNTIME_SRC="$ROOT/dist"
OUT_DIR="$ROOT/artifacts/publish"

if [[ ! -d "$RUNTIME_SRC/site" ]]; then
  echo "ERROR: Runtime build output not found at $RUNTIME_SRC/site — run 'npm run build' first."
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "Packaging runtime artifact..."
tar -czf "$OUT_DIR/runtime.tar.gz" -C "$RUNTIME_SRC" .

echo "Computing checksums..."
cd "$OUT_DIR"
shasum -a 256 runtime.tar.gz > checksums.txt

echo "Artifacts written to $OUT_DIR:"
ls -lh "$OUT_DIR"
cat "$OUT_DIR/checksums.txt"
