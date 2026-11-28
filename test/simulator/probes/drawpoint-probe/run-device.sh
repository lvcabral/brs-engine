#!/bin/zsh
# Sideloads and runs the probe; writes device-trace.txt (decode with ../decode-px.mjs).
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh
set -u
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
nap() { perl -e "select undef,undef,undef,$1"; }
./pack.sh > /dev/null
curl -s --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Install -F archive=@drawpoint-probe.zip http://$IP/plugin_install -o /dev/null
nap 3
curl -s -d '' http://$IP:8060/keypress/Home
nap 2
log=console.txt
: > $log
( while true; do sleep 600 | nc $IP 8085 >> $log; nap 0.5; done ) & LOOP=$!
nap 1
curl -s -d '' http://$IP:8060/launch/dev
deadline=$((SECONDS + 60))
while (( SECONDS < deadline )); do
    tr -d '\r' < $log | grep -q '^PROBE|done' && break
    nap 1
done
kill $LOOP 2>/dev/null
pkill -f "nc $IP 8085" 2>/dev/null
tr -d '\r' < $log | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done)$' | awk '!seen[$0]++' > device-trace.txt
rm -f $log
