#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh <probeDir> <outFile> — one long console session; key pairs with tight gaps.
set -u
SRC=$1; OUT=$2
IP=${ROKU_IP:?set ROKU_IP}; PW=${ROKU_PASS:?set ROKU_PASS}
nap() { perl -e "select undef,undef,undef,$1"; }
W=$(mktemp -d); cp -R $SRC/. $W/
sed -i '' 's/^sub Main(\(.*\))$/sub Main(\1)\n    sleep(8000)/' $W/source/main.brs
(cd $W && zip -qr app.zip manifest source components)
curl -s --digest -u rokudev:$PW -F mysubmit=Install -F archive=@$W/app.zip http://$IP/plugin_install -o /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d '' http://$IP:8060/launch/dev; nap 4
perl -e 'alarm 45; exec @ARGV' nc $IP 8085 | tr -d '\r' > $W/raw.txt &
NC=$!
for i in {1..30}; do nap 1; grep -q "|ready" $W/raw.txt 2>/dev/null && break; done
nap 1
key() { curl -s -d '' http://$IP:8060/keypress/$1; }
key Right; key Select; nap 2
key Right; nap 0.6; key Select; nap 2
key Select; nap 2
kill $NC 2>/dev/null; pkill -f "nc $IP 8085"; sleep 1
grep "PROBE|" $W/raw.txt > $OUT; wc -l < $OUT
