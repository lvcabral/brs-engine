#!/bin/zsh
# Runs the probe in the engine CLI (after npm run build:cli and npm link in packages/node); writes engine-trace.txt
# (decode with ../decode-px.mjs).
set -u
cd "$(dirname "$0")"
brs-cli --root . 2>&1 | tr -d '\r' | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done)$' > engine-trace.txt
