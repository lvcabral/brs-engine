#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh <style>  — runs the short-row scenario on the device, saving screenshots and the console log.
IP=${ROKU_IP:?set ROKU_IP}
OUT=${OUT_DIR:-./out}/$1
mkdir -p $OUT
nap() { perl -e "select undef,undef,undef,$1"; }
shot() { curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null; curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} http://$IP/pkgs/dev.jpg -o $OUT/$1.jpg; }
key() { curl -s -d '' http://$IP:8060/keypress/$1; }
step() { echo "STEP|$1" >> $OUT/steps.txt; }
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
nc $IP 8085 > $OUT/console.txt & NCPID=$!
nap 1
curl -s -d '' "http://$IP:8060/launch/dev?style=$1"; nap 5
for i in 1 2 3 4 5; do key Right; nap 0.6; done
nap 0.5; shot a-row0-col5
key Down; shot b-down-moving; nap 1; shot c-row1
key Right; nap 0.8; shot d-row1-right
key Down; shot e-down-moving; nap 1; shot f-row2
key Up; shot g-up-moving; nap 1; shot h-back-row1
key Up; nap 1; shot i-back-row0
nap 1
kill $NCPID
tr -d '\r' < $OUT/console.txt | sed -n '/ready|'$1'/,$p' | grep "PROBE|" > $OUT/trace.txt
