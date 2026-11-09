#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh  — runs the hero-grid scenario, taking a screenshot right after each row change and after it settles, and saving the console trace.
IP=${ROKU_IP:?set ROKU_IP}
OUT=${OUT_DIR:-./out}
mkdir -p $OUT
nap() { perl -e "select undef,undef,undef,$1"; }
shot() { curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null; curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} http://$IP/pkgs/dev.jpg -o $OUT/$1.jpg; }
key() { curl -s -d '' http://$IP:8060/keypress/$1; }
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
nc $IP 8085 > $OUT/console.txt & NCPID=$!
nap 1
curl -s -d '' "http://$IP:8060/launch/dev"; nap 5
key Down; shot a-hero-to-action-moving; nap 1
for i in 1 2 3; do key Right; nap 0.8; done
shot b-action-col3
key Down; shot c-action-to-drama-moving; nap 1; shot d-drama
key Down; shot e-drama-to-grid-moving; nap 1
key Right; nap 0.8; key Right; nap 0.8; shot f-grid0-col2
key Down; shot g-grid0-to-grid1-moving; nap 1; shot h-grid1
key Down; nap 1; shot i-grid2
key Up; nap 1; key Up; nap 1; shot j-back-grid0
key Up; nap 1; shot k-back-drama
key Down; nap 1; shot l-drama-to-grid0
key Right; nap 0.8; key Right; nap 0.8; key Right; nap 0.8
key Down; nap 1; key Down; nap 1; key Down; nap 1; shot m-grid3-short-row
nap 1
kill $NCPID
tr -d '\r' < $OUT/console.txt | awk '/PROBE\|ready/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' | grep "PROBE|" > $OUT/trace.txt
