#!/usr/bin/env bash
# Package runtime build output into a versioned tarball.
# Run from repo root after `npm run build`.
#
# Outputs (under artifacts/publish/):
#   runtime.tar.gz   – compressed dist/site/ directory contents
#   checksums.txt    – sha256 checksum for the tarball
#
# Note: Vite outputs to dist/site/ (base: '/site/') so we tar from there.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RUNTIME_SRC="$ROOT/dist/site"
OUT_DIR="$ROOT/artifacts/publish"

if [[ ! -d "$RUNTIME_SRC" ]]; then
  echo "ERROR: Runtime build output not found at $RUNTIME_SRC — run 'npm run build' first."
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
