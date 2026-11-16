#!/bin/zsh
# Sideloads the probe and saves its PROBE lines.
#   Device: ROKU_IP=<ip> ROKU_PASS=<pw> ./capture.sh [hd|fhd]   -> device-trace-<res>.txt
#   Engine: ENGINE=1 ./capture.sh [hd|fhd]                       -> engine-trace-<res>.txt (after npm run build:cli)
set -u
cd "$(dirname "$0")"
RES=${1:-fhd}
nap() { perl -e "select undef,undef,undef,$1"; }
STAGE=$(mktemp -d)
cp -R source components images $STAGE/
if [[ $RES == hd ]]; then cp manifest-hd $STAGE/manifest; else cp manifest $STAGE/manifest; fi
if [[ -n ${ENGINE:-} ]]; then
    REPO=$(cd ../../../.. && pwd)
    perl -e 'alarm 180; exec @ARGV' node $REPO/packages/node/bin/brs.cli.js --root $STAGE source/main.brs < /dev/null 2>&1 \
        | tr -d '\r' | grep "PROBE|" > engine-trace-$RES.txt
    rm -rf $STAGE
    echo "Saved $(wc -l < engine-trace-$RES.txt) lines to engine-trace-$RES.txt"
    exit 0
fi
IP=${ROKU_IP:?set ROKU_IP}
ZIP=$STAGE/probe.zip
(cd $STAGE && zip -qr probe.zip manifest source components images -x '*.DS_Store')
curl -s -m 30 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Install -F archive=@$ZIP http://$IP/plugin_install > /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
CONSOLE=$STAGE/console.txt
: > $CONSOLE
curl -s -d '' http://$IP:8060/launch/dev; nap 1
# The launch drops console clients: keep reconnecting. nc's stdin must stay open or the device hangs up.
( while true; do sleep 600 | nc $IP 8085 >> $CONSOLE; nap 0.5; done ) & LOOP=$!
deadline=$((SECONDS + 240))
while (( SECONDS < deadline )); do
    tr -d '\r' < $CONSOLE | awk '/PROBE\|boot\|/{n=0} {n++} /PROBE\|done/ && n > 1 {found=1} END{exit !found}' && break
    nap 1
done
kill $LOOP 2>/dev/null; pkill -f "nc $IP 8085"; pkill -f "sleep 600"
tr -d '\r' < $CONSOLE | awk '/PROBE\|boot\|/{delete seen; n=0} !seen[$0]++ {buf[n++]=$0} END{for (i = 0; i < n; i++) print buf[i]}' \
    | grep "PROBE|" > device-trace-$RES.txt
rm -rf $STAGE
echo "Saved $(wc -l < device-trace-$RES.txt) lines to device-trace-$RES.txt"
