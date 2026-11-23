#!/bin/bash
# Usage: ROKU_IP=<ip> ROKU_PASS=<password> ./run-device.sh
# Sideloads the probe, launches it, and writes its PROBE| console lines to device-trace.txt.
set -u
IP=${ROKU_IP:?set ROKU_IP}
PW=${ROKU_PASS:?set ROKU_PASS}
HERE=$(cd "$(dirname "$0")" && pwd)
ZIP=$(mktemp -t return-value-probe).zip
RAW=$(mktemp -t return-value-probe-console)

cleanup() {
    pkill -f "nc $IP 8085" 2>/dev/null
    pkill -f "sleep 600" 2>/dev/null
    rm -f "$ZIP" "$RAW"
}
cleanup
trap cleanup EXIT

(cd "$HERE" && zip -qr "$ZIP" manifest source components)
curl -s --digest -u "rokudev:$PW" -F mysubmit=Install -F "archive=@$ZIP" "http://$IP/plugin_install" > /dev/null
curl -s -X POST "http://$IP:8060/keypress/Home" > /dev/null
perl -e 'select undef,undef,undef,1.5'
curl -s -X POST "http://$IP:8060/launch/dev" > /dev/null

# The console drops its clients when the app launches, so reconnect until this run prints PROBE|done.
lastRun() { tr -d '\r' < "$RAW" | awk '/Entering .return-value-probe/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}'; }
for _ in $(seq 1 8); do
    perl -e 'alarm 12; exec @ARGV' sh -c "sleep 600 | nc $IP 8085" >> "$RAW" 2> /dev/null
    pkill -f "nc $IP 8085" 2>/dev/null
    lastRun | grep -q "PROBE|done" && break
done
lastRun | grep "^PROBE|" > "$HERE/device-trace.txt"
cat "$HERE/device-trace.txt"
