#!/bin/sh
# Usage: run-device.sh <ip> <password> <outdir>
# Sideloads the probe, steps it with ECP (Play = next key, Select = press it), saves a screenshot
# after each selection and the console trace to <outdir>/device-trace.txt.
IP=$1; PW=$2; OUT=$3; HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"; ZIP="$OUT/probe.zip"; rm -f "$ZIP"
(cd "$HERE" && zip -qr "$ZIP" manifest source components)
curl -s --digest -u "rokudev:$PW" -F mysubmit=Install -F archive=@"$ZIP" "http://$IP/plugin_install" > /dev/null
w() { perl -e "select undef,undef,undef,$1"; }
k() { curl -s -X POST "http://$IP:8060/keypress/$1"; }
shot() {
    curl -s --digest -u "rokudev:$PW" -F mysubmit=Screenshot -F passwd= -F archive= "http://$IP/plugin_inspect" > /dev/null
    curl -s --digest -u "rokudev:$PW" "http://$IP/pkgs/dev.jpg" -o "$OUT/$1.jpg"
}
w 3
perl -e 'alarm 200; exec @ARGV' nc "$IP" 8085 > "$OUT/raw.txt" &
NC=$!
w 3
shot 00-initial
i=0
STEPS=$(grep -c 'key: \[' "$HERE/components/ProbeScene.xml")
while [ $i -lt "$STEPS" ]; do
    k Play; w 0.8; k Select; w 1.2
    i=$((i + 1)); shot "$(printf %02d $i)"
done
k Play; w 2
kill $NC 2>/dev/null
tr -d '\r' < "$OUT/raw.txt" | grep "^PROBE|" > "$OUT/device-trace.txt"
