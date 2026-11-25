#!/bin/zsh
# Runs the probe in the engine CLI (npm-linked brs-cli, after npm run build:cli); writes engine-trace.txt.
# Usage: ./run-engine.sh [trace-file]
set -u
cd "$(dirname "$0")"
out=${1:-engine-trace.txt}
brs-cli --root . 2>&1 | tr -d '\r' | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done)$' > $out
