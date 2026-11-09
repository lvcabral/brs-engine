#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh — sideloads the probe, captures its console trace to
# $OUT_DIR/device-trace.txt and a screenshot of the limitSize Posters to $OUT_DIR/device-posters.jpg.
set -u
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
PW=${ROKU_PASS:?set ROKU_PASS}
OUT=${OUT_DIR:-./out}
mkdir -p $OUT
nap() { perl -e "select undef,undef,undef,$1"; }
./pack.sh >/dev/null
curl -s --digest -u rokudev:$PW -F mysubmit=Install -F archive=@focus-motion-edge-probe.zip http://$IP/plugin_install -o /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d '' http://$IP:8060/launch/dev; nap 3
# The console drops its clients around the launch: reconnect until one session lasts past `done`.
: > $OUT/raw.txt
(
    for n in {1..20}; do
        perl -e 'alarm 45; exec @ARGV' nc $IP 8085 | tr -d '\r' > $OUT/raw-$n.txt
        grep -q "PROBE|[0-9]*|done" $OUT/raw-$n.txt && break
        nap 0.5
    done
) &
SHOT=0
for i in {1..45}; do
    nap 1
    cat $OUT/raw-*.txt > $OUT/raw.txt 2>/dev/null
    if [[ $SHOT == 0 ]] && grep -q "PROBE|[0-9]*|shot" $OUT/raw.txt; then
        SHOT=1
        nap 1
        curl -s -m 10 --digest -u rokudev:$PW -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null
        curl -s -m 10 --digest -u rokudev:$PW http://$IP/pkgs/dev.jpg -o $OUT/device-posters.jpg
    fi
    grep -q "PROBE|[0-9]*|done" $OUT/raw.txt && break
done
pkill -f "nc $IP 8085" 2>/dev/null
# The session that saw `done` from its start holds the whole trace (`start` .. `done`).
for f in $OUT/raw-*.txt; do
    if grep -q "PROBE|[0-9]*|start" $f && grep -q "PROBE|[0-9]*|done" $f; then
        awk '/PROBE\|[0-9]*\|start/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' $f | grep "^PROBE|" > $OUT/device-trace.txt
    fi
done
rm -f $OUT/raw-*.txt
wc -l $OUT/device-trace.txt
