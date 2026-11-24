#!/bin/bash
# Usage: ROKU_IP=<ip> ROKU_PASS=<password> ./run-device.sh
# Sideloads each app under cases/ (a compile error stops a whole app, so every case is its own app)
# and writes the compile error or the PROBE| lines of each to device-trace.txt.
set -u
IP=${ROKU_IP:?set ROKU_IP}
PW=${ROKU_PASS:?set ROKU_PASS}
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d -t loop-exit-scope-probe)
OUT="$HERE/device-trace.txt"

kill_nc() {
    pkill -f "nc $IP 8085" 2> /dev/null
    pkill -f "sleep 600" 2> /dev/null
}
trap 'kill_nc; rm -rf "$TMP"' EXIT

: > "$OUT"
while read -r name; do
    [ -n "$name" ] || continue
    kill_nc
    ZIP="$TMP/$name.zip"
    RAW="$TMP/$name.txt"
    (cd "$HERE/cases/$name" && zip -qr "$ZIP" manifest source)
    curl -s -X POST "http://$IP:8060/keypress/Home" > /dev/null
    perl -e 'select undef,undef,undef,1.5'
    # One console connection kept open across the install captures the compile output.
    (sleep 600 | nc "$IP" 8085 >> "$RAW" 2> /dev/null) &
    perl -e 'select undef,undef,undef,1'
    curl -s --digest -u "rokudev:$PW" -F mysubmit=Install -F "archive=@$ZIP" "http://$IP/plugin_install" > /dev/null
    for _ in $(seq 1 6); do
        perl -e 'select undef,undef,undef,3'
        tr -d '\r' < "$RAW" | grep -q "PROBE|done\|compile error" && break
        pgrep -f "nc $IP 8085" > /dev/null || (sleep 600 | nc "$IP" 8085 >> "$RAW" 2> /dev/null) &
    done
    perl -e 'select undef,undef,undef,1'
    kill_nc
    echo "== $name" >> "$OUT"
    # Keep only this app's run: the console replays earlier history on connect.
    tr -d '\r' < "$RAW" \
        | awk -v t="'stray-$name'" 'index($0, "Compiling dev " t) {buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' \
        | sed -nE 's/^(.*\(compile error &h[0-9a-f]+\)) in pkg:\/source\/main\.brs\(([0-9]+)\)$/COMPILE|\1|line \2/p; s/ +$//; /^PROBE\|/p' \
        >> "$OUT"
done < "$HERE/cases.txt"
cat "$OUT"
