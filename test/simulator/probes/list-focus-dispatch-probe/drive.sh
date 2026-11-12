#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh — sideloads the probe and captures its console trace to
# $OUT_DIR/device-trace.txt (default ./out).
set -u
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
PW=${ROKU_PASS:?set ROKU_PASS}
OUT=${OUT_DIR:-./out}
mkdir -p $OUT
nap() { perl -e "select undef,undef,undef,$1"; }
./pack.sh >/dev/null
curl -s --digest -u rokudev:$PW -F mysubmit=Install -F archive=@list-focus-dispatch-probe.zip http://$IP/plugin_install -o /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d '' http://$IP:8060/launch/dev; nap 3
# The console drops its clients around the launch: reconnect until one session lasts from `boot` to `done`.
(
    for n in {1..20}; do
        perl -e 'alarm 45; exec @ARGV' nc $IP 8085 | tr -d '\r' > $OUT/raw-$n.txt
        grep -q "PROBE|[0-9]*|done" $OUT/raw-$n.txt && break
        nap 0.5
    done
) &
for i in {1..45}; do
    nap 1
    cat $OUT/raw-*.txt 2>/dev/null | grep -q "PROBE|[0-9]*|done" && break
done
pkill -f "nc $IP 8085" 2>/dev/null
for f in $OUT/raw-*.txt; do
    if grep -q "PROBE|boot" $f && grep -q "PROBE|[0-9]*|done" $f; then
        awk '/PROBE\|boot/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' $f | grep "^PROBE|" > $OUT/device-trace.txt
    fi
done
rm -f $OUT/raw-*.txt
wc -l $OUT/device-trace.txt
