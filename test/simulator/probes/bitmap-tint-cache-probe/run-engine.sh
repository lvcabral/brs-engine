#!/bin/zsh
# Runs the same launches as run-device.sh in the engine CLI (after npm run build:cli); writes engine-trace.txt.
# Usage: ./run-engine.sh [case...]
set -u
cd "$(dirname "$0")"
CLI=../../../../packages/node/bin/brs.cli.js
cases=(main self.whole self.scaled self.rotated self.transformed self.region self.regiondst)
(( $# )) && cases=($@)
: > engine-trace.txt
for c in $cases; do
    if [[ $c == main ]]; then out=$(node $CLI --root . 2>&1); else out=$(node $CLI --root . --deep-link contentId=$c 2>&1); fi
    print -r -- "$out" | tr -d '\r' | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done)$' >> engine-trace.txt
done
