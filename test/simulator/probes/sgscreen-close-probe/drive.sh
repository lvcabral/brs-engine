#!/bin/zsh
# Runs the probe and answers its PROBE|<seq>|await|<what>| lines: a key name gets an ECP keypress, "shot"
# saves a dev-mode screenshot as $OUT/<name>.jpg (device only). Writes $OUT/trace.txt.
#
# Device (sideload ./pack.sh's zip first):  ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh
# Engine (after npm run build:cli):          ENGINE=1 ./drive.sh
# MODE=solo|roscreen-after|roscreen-before|sgscreen-after picks the scenario (launch parameter).
set -u
cd "$(dirname "$0")"
PROBE_DIR=$(pwd)
MODE=${MODE:-solo}
OUT=${OUT_DIR:-./out-$MODE}
mkdir -p $OUT
CONSOLE=$OUT/console.txt
: > $CONSOLE
nap() { perl -e "select undef,undef,undef,$1"; }

if [[ -n ${ENGINE:-} ]]; then
    IP=127.0.0.1
    REPO=$(cd ../../../.. && pwd)
    node $REPO/packages/node/bin/brs.cli.js --root $PROBE_DIR --ecp --deep-link "mode=$MODE" > $CONSOLE 2>&1 &
    RUNPID=$!
else
    IP=${ROKU_IP:?set ROKU_IP}
    curl -s -d '' http://$IP:8060/keypress/Home; nap 2
    curl -s -d '' "http://$IP:8060/launch/dev?mode=$MODE"; nap 3
    # The launch drops console clients, so reconnect until the run ends (the console replays history on
    # each connect; current() drops the repeated lines). nc's stdin stays open: at EOF the device hangs up.
    ( while true; do sleep 600 | nc $IP 8085 >> $CONSOLE; nap 0.5; done ) & RUNPID=$!
fi

shot() {
    [[ -n ${ENGINE:-} ]] && return
    curl -s -m 10 --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Screenshot -F passwd= -F archive= http://$IP/plugin_inspect -o /dev/null
    curl -s -m 10 --digest -u rokudev:${ROKU_PASS} http://$IP/pkgs/dev.jpg -o $OUT/$1.jpg
}

# Lines of the current run only: after the last boot|start (the console replays earlier runs on connect).
current() { tr -d '\r' < $CONSOLE | awk '/PROBE\|000\|boot\|start\|/{n=0; delete seen} !seen[$0]++ {buf[n++]=$0} END{for (i = 0; i < n; i++) print buf[i]}'; }

last=0
deadline=$((SECONDS + ${DEADLINE:-300}))
while (( SECONDS < deadline )); do
    current | grep -E "PROBE\|[0-9]+\|done\||^------ Finished|UI: Exiting '" > /dev/null && break
    for line in ${(f)"$(current | grep -E '^PROBE\|[0-9]+\|await\|')"}; do
        seq=${${line#PROBE|}%%|*}
        (( 10#$seq <= last )) && continue
        last=$((10#$seq))
        what=$(echo $line | cut -d'|' -f4)
        if [[ $what == shot ]]; then
            name=${line##*name=}
            shot $name
            echo "shot $name"
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
current | grep -E "^PROBE\||UI: Exiting '" > $OUT/trace.txt
echo "Wrote $OUT/trace.txt ($(wc -l < $OUT/trace.txt) lines)"
