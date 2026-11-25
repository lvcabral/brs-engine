#!/bin/zsh
# Runs the probe in the engine CLI (npm-linked brs-cli, after npm run build:cli) for 9 s; writes engine-trace.txt.
# Usage: ./run-engine.sh [trace-file]
set -u
cd "$(dirname "$0")"
out=${1:-engine-trace.txt}
brs-cli --root . > console.txt 2>&1 & PID=$!
perl -e 'select undef,undef,undef,9'
kill $PID 2>/dev/null
tr -d '\r' < console.txt | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done|shot)$' > $out
