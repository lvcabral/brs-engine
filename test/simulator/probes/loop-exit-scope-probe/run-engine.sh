#!/bin/bash
# Usage: ./run-engine.sh   (needs brs-cli on PATH)
# Runs each app under cases/ in the engine and writes engine-trace.txt in the device-trace format.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/engine-trace.txt"

: > "$OUT"
while read -r name; do
    [ -n "$name" ] || continue
    echo "== $name" >> "$OUT"
    brs-cli "$HERE/cases/$name/source/main.brs" 2>&1 | tr -d '\r' \
        | sed -nE 's/^pkg:\/source\/main\.brs\(([0-9]+),[^)]*\): (.*\(compile error &h[0-9a-f]+\))$/COMPILE|\2|line \1/p; s/ +$//; /^PROBE\|/p' \
        >> "$OUT"
done < "$HERE/cases.txt"
cat "$OUT"
