#!/bin/zsh
# Sideloads the probe, launches it, captures the console and takes a screenshot (device-shot.jpg) on "PROBE|shot".
# Writes device-trace.txt.
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./run-device.sh [trace-file]
set -u
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
PASS=${ROKU_PASS:?set ROKU_PASS}
out=${1:-device-trace.txt}
nap() { perl -e "select undef,undef,undef,$1"; }
# Stops the console loop and only its own sleep/nc children.
stop_loop() { kill -STOP $1; kill $(pgrep -P $1) $1 2>/dev/null; kill -CONT $1 2>/dev/null; }
./pack.sh > /dev/null
curl -s --digest -u rokudev:$PASS -F mysubmit=Install -F archive=@animated-image-node-probe.zip http://$IP/plugin_install -o /dev/null
nap 3
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
log=console.txt
: > $log
( while true; do sleep 600 | nc $IP 8085 >> $log; nap 0.5; done ) & LOOP=$!
nap 1
curl -s -d '' http://$IP:8060/launch/dev
shot=0
deadline=$((SECONDS + 60))
while (( SECONDS < deadline )); do
    cur=$(tr -d '\r' < $log | awk '/PROBE\|start/{n=0} {buf[n++]=$0} END{for(i=0;i<n;i++) print buf[i]}')
    if (( !shot )) && print -r -- "$cur" | grep -q '^PROBE|shot'; then
        nap 0.5
        curl -s --digest -u rokudev:$PASS -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null
        curl -s --digest -u rokudev:$PASS http://$IP/pkgs/dev.jpg -o device-shot.jpg
        shot=1
    fi
    print -r -- "$cur" | grep -qE '^PROBE\|done|Brightscript Debugger' && break
    nap 0.5
done
nap 1
stop_loop $LOOP
tr -d '\r' < $log | awk '/PROBE\|start/{n=0; delete seen} !seen[$0]++ {buf[n++]=$0} END{for(i=0;i<n;i++) print buf[i]}' \
    | grep -E '^PROBE\|' | grep -vE '^PROBE\|(start|done|shot)$' > $out
