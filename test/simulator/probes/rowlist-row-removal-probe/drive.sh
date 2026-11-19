#!/bin/zsh
# Runs the probe on a device and answers its PROBE|<seq>|await|<what>| lines: a key name gets an ECP keypress,
# "shot" saves a dev-mode screenshot as $OUT/device-<name>.jpg. Writes $OUT/device-trace.txt.
#
# Sideload ./pack.sh's zip first, then:  ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh
# Engine run (screenshots via Ctrl+S):    python3 drive-engine.py
set -u
cd "$(dirname "$0")"
OUT=${OUT_DIR:-.}
mkdir -p $OUT
CONSOLE=$OUT/console.txt
: > $CONSOLE
nap() { perl -e "select undef,undef,undef,$1"; }
IP=${ROKU_IP:?set ROKU_IP}

curl -s -d '' http://$IP:8060/keypress/Home; nap 2
curl -s -d '' "http://$IP:8060/launch/dev"; nap 3
# The launch drops console clients, so reconnect until the run ends. nc's stdin stays open: at EOF the
# device hangs up.
( while true; do sleep 600 | nc $IP 8085 >> $CONSOLE; nap 0.5; done ) & RUNPID=$!

shot() {
    curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null
    curl -s -m 10 --digest -u rokudev:${ROKU_PASS} http://$IP/pkgs/dev.jpg -o $OUT/device-$1.jpg
}

# Lines of the current run only: after the last boot|start (the console replays earlier runs on connect).
current() { tr -d '\r' < $CONSOLE | awk '/PROBE\|000\|boot\|start\|/{n=0; delete seen} !seen[$0]++ {buf[n++]=$0} END{for (i = 0; i < n; i++) print buf[i]}'; }

last=0
deadline=$((SECONDS + 240))
while (( SECONDS < deadline )); do
    run=$(current)
    grep -qE "PROBE\|[0-9]+\|done\|" <<< $run && break
    for line in ${(f)"$(grep -E '^PROBE\|[0-9]+\|await\|' <<< $run)"}; do
        seq=${${line#PROBE|}%%|*}
        (( 10#$seq <= last )) && continue
        last=$((10#$seq))
        what=$(echo $line | cut -d'|' -f4)
        if [[ $what == shot ]]; then
            shot ${line##*name=}
            echo "shot ${line##*name=}"
        else
            curl -s -d '' http://$IP:8060/keypress/$what
            echo "key $what (seq $seq)"
        fi
    done
    nap 0.3
done
nap 2
kill $RUNPID 2>/dev/null
pkill -f "nc $IP 8085" 2>/dev/null
pkill -f "sleep 600" 2>/dev/null
current | grep "^PROBE|" > $OUT/device-trace.txt
echo "Wrote $OUT/device-trace.txt ($(wc -l < $OUT/device-trace.txt) lines)"
