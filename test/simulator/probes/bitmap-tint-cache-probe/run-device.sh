#!/bin/zsh
# Sideloads the probe and runs it once with no case, then once per self-draw case (a launch each, since some of
# them crash the device). Writes device-trace.txt (decode with ../decode-px.mjs) and console-<case>.txt.
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh [case...]
set -u
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
nap() { perl -e "select undef,undef,undef,$1"; }
./pack.sh > /dev/null
curl -s --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Install -F archive=@bitmap-tint-cache-probe.zip http://$IP/plugin_install -o /dev/null
nap 3
cases=(main self.whole self.scaled self.rotated self.transformed self.region self.regiondst)
(( $# )) && cases=($@)
: > device-trace.txt
for c in $cases; do
    curl -s -d '' http://$IP:8060/keypress/Home; nap 2
    if [[ $c == main ]]; then curl -s -d '' http://$IP:8060/launch/dev; else curl -s -d '' "http://$IP:8060/launch/dev?contentId=$c"; fi
    nap 2
    log=console-$c.txt
    : > $log
    ( while true; do sleep 600 | nc $IP 8085 >> $log; nap 0.5; done ) & LOOP=$!
    deadline=$((SECONDS + 90))
    while (( SECONDS < deadline )); do
        tr -d '\r' < $log | awk '/PROBE\|start/{n=0} {buf[n++]=$0} END{for(i=0;i<n;i++) print buf[i]}' | grep -qE '^PROBE\|done|EXIT_SYSTEM_KILL|Brightscript Debugger' && break
        nap 1
    done
    nap 1
    kill $LOOP 2>/dev/null; pkill -f "nc $IP 8085" 2>/dev/null
    tr -d '\r' < $log | awk '/PROBE\|start/{n=0; delete seen} !seen[$0]++ {buf[n++]=$0} END{for(i=0;i<n;i++) print buf[i]}' > $log.cur
    mv $log.cur $log
    if grep -q EXIT_SYSTEM_KILL $log && ! grep -q '^PROBE|done' $log; then echo "PROBE|$c|device-crash" >> device-trace.txt; fi
    grep -E '^PROBE\|' $log | grep -vE '^PROBE\|(start|done)$' >> device-trace.txt
done
