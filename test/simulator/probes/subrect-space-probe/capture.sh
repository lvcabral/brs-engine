#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./capture.sh  — sideloads the probe and saves the PROBE lines to trace.txt.
set -e
cd "$(dirname "$0")"
IP=${ROKU_IP:?set ROKU_IP}
nap() { perl -e "select undef,undef,undef,$1"; }
rm -f subrect-space-probe.zip
zip -qr subrect-space-probe.zip manifest source components images -x '*.DS_Store'
curl -s -m 30 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Install -F archive=@subrect-space-probe.zip http://$IP/plugin_install > /dev/null
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
perl -e 'alarm 25; exec @ARGV' nc $IP 8085 > console.txt &
nap 1.5
curl -s -d '' http://$IP:8060/launch/dev
wait || true
tr -d '\r' < console.txt | awk '/Entering .SubRect Space Probe/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' | grep "PROBE|" > trace.txt
rm -f console.txt
echo "Saved $(wc -l < trace.txt) lines to trace.txt"
