#!/bin/zsh
# Sideloads the probe, launches it and captures the console; writes device-trace.txt.
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh [trace-file]
set -u
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
out=${1:-device-trace.txt}
nap() { perl -e "select undef,undef,undef,$1"; }
# Stops the console loop and only its own sleep/nc children.
stop_loop() { kill -STOP $1; kill $(pgrep -P $1) $1 2>/dev/null; kill -CONT $1 2>/dev/null; }
./pack.sh > /dev/null
curl -s --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Install -F archive=@layoutgroup-reentry-probe.zip http://$IP/plugin_install -o /dev/null
nap 3
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d '' http://$IP:8060/launch/dev; nap 2
log=console.txt
: > $log
( while true; do sleep 600 | nc $IP 8085 >> $log; nap 0.5; done ) & LOOP=$!
deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
    tr -d '\r' < $log | awk '/PROBE\|start/{n=0} {buf[n++]=$0} END{for(i=0;i<n;i++) print buf[i]}' | grep -qE '^PROBE\|done|Brightscript Debugger' && break
    nap 1
done
nap 1
stop_loop $LOOP
# The live capture sometimes misses the run; the console replays its recent history on connect.
grep -q '^PROBE|done' $log || (sleep 5 | nc $IP 8085 >> $log)
tr -d '\r' < $log | awk '/PROBE\|start/{n=0; delete seen} !seen[$0]++ {buf[n++]=$0} END{for(i=0;i<n;i++) print buf[i]}' \
    | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done)$' > $out
