#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh <probeDir> <outFile> "<key> <key> ..." <case>
# Sideloads the probe, launches it with case=<case> and a run nonce, keeps a console client reconnected
# (the device drops clients on launch and replays a partial buffer on each reconnect), sends the keys
# 2.5 s apart once the probe prints |MANUAL|, then writes this run's PROBE lines, deduped, to <outFile>.
set -u
setopt null_glob
SRC=$1; OUT=$2; KEYS=$3; CASE=$4
IP=${ROKU_IP:?set ROKU_IP}; PW=${ROKU_PASS:?set ROKU_PASS}
RUN=$RANDOM$RANDOM
nap() { perl -e "select undef,undef,undef,$1"; }
W=$(mktemp -d); cp -R $SRC/. $W/; rm -f $W/*.zip $W/*.txt $W/*.md $W/*.sh
(cd $W && zip -qr app.zip manifest source components)
curl -s --digest -u rokudev:$PW -F mysubmit=Install -F archive=@$W/app.zip http://$IP/plugin_install -o /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
( while true; do nc $IP 8085 >> $W/raw.txt 2>/dev/null; nap 0.3; done ) &
LOOP=$!
nap 1
curl -s -d "" "http://$IP:8060/launch/dev?case=$CASE&run=$RUN"
for i in {1..40}; do nap 1; grep -q "@$RUN|.*|MANUAL|" $W/raw.txt 2>/dev/null && break; done
nap 1
for k in ${(s: :)KEYS}; do curl -s -d '' http://$IP:8060/keypress/$k; nap 2.5; done
nap 2
kill $LOOP 2>/dev/null; pkill -f "nc $IP 8085" 2>/dev/null; sleep 1
tr -d '\r' < $W/raw.txt | grep "^PROBE|$CASE@$RUN|" | awk '!seen[$0]++' | sort -t'|' -k3,3 > $OUT
wc -l < $OUT
