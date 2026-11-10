#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh <probeDir> <outFile> "<key> <key> ..." [launch query]: sideload, launch,
# open one console session; after the probe prints |MANUAL| (or PROBE|done), send the keys 1.5 s apart.
set -u
SRC=$1; OUT=$2; KEYS=$3; QUERY=${4:-}
IP=${ROKU_IP:?set ROKU_IP}; PW=${ROKU_PASS:?set ROKU_PASS}
nap() { perl -e "select undef,undef,undef,$1"; }
pkill -f "nc $IP 8085" 2>/dev/null
W=$(mktemp -d); cp -R $SRC/. $W/; rm -f $W/*.zip $W/*.txt $W/*.md
sed -i '' 's/^sub Main(\(.*\))$/sub Main(\1)\n    sleep(8000)/' $W/source/main.brs
(cd $W && zip -qr app.zip manifest source components)
curl -s --digest -u rokudev:$PW -F mysubmit=Install -F archive=@$W/app.zip http://$IP/plugin_install -o /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d "" "http://$IP:8060/launch/dev?$QUERY"; nap 4
perl -e 'alarm 60; exec @ARGV' nc $IP 8085 | tr -d '\r' > $W/raw.txt &
for i in {1..30}; do nap 1; grep -q "|MANUAL|\\|PROBE|done" $W/raw.txt 2>/dev/null && break; done
nap 1
for k in ${(s: :)KEYS}; do curl -s -d '' http://$IP:8060/keypress/$k; nap 1.5; done
nap 1; pkill -f "nc $IP 8085"; sleep 1
grep "PROBE|" $W/raw.txt > $OUT; wc -l < $OUT
