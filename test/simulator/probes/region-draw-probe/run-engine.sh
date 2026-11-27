#!/bin/zsh
# Runs the probe in the engine CLI (after npm run build:cli); writes engine-trace.txt (decode with ../decode-px.mjs).
set -u
cd "$(dirname "$0")"
node ../../../../packages/node/bin/brs.cli.js --root . 2>&1 | tr -d '\r' | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done)$' > engine-trace.txt
