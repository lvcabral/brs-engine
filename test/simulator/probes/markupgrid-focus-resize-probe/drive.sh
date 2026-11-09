#!/bin/zsh
# Usage: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh <style> [grid|mlist|llist]  — moves the focus between small and large items, taking a screenshot mid-move and after each settle.
IP=${ROKU_IP:?set ROKU_IP}
NODE=${2:-grid}
OUT=${OUT_DIR:-./out}/$NODE-$1
mkdir -p $OUT
nap() { perl -e "select undef,undef,undef,$1"; }
shot() { curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null; curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} http://$IP/pkgs/dev.jpg -o $OUT/$1.jpg; }
key() { curl -s -d '' http://$IP:8060/keypress/$1; }
curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d '' "http://$IP:8060/launch/dev?node=$NODE&style=$1"; nap 5
shot a-rest
if [[ $NODE == grid ]]; then
    key Right; shot b-right-moving; nap 1; shot c-i1
    key Left; shot d-left-moving; nap 1; shot e-i0
    key Down; shot f-down-moving; nap 1; shot g-i2
    key Down; shot h-down-moving; nap 1; shot i-i4
    key Right; nap 1; key Up; shot j-up-moving; nap 1; shot k-i3
else
    key Down; shot b-down-grow; nap 1; shot c-row1
    key Down; shot d-down-shrink; nap 1; shot e-row2
    key Down; nap 1; key Up; shot f-up-grow; nap 1; shot g-row1
fi
