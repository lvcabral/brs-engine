#!/bin/zsh
# Runs the probe and writes $OUT/trace.txt (PROBE lines) and $OUT/run.txt (the whole console of the run).
#
# Device: ROKU_IP=<ip> ROKU_PASS=<pw> ./drive.sh [launch params, e.g. start=12]
# Engine (after npm run build:cli): ENGINE=1 ./drive.sh [start=12]
set -u
cd "$(dirname "$0")"
PROBE_DIR=$(pwd)
OUT=${OUT_DIR:-./out}
mkdir -p $OUT
CONSOLE=$OUT/console.txt
: > $CONSOLE
nap() { perl -e "select undef,undef,undef,$1"; }
RUN=$RANDOM
PARAMS="run=$RUN${1:+&$1}"

if [[ -n ${ENGINE:-} ]]; then
    REPO=$(cd ../../../.. && pwd)
    node $REPO/packages/node/bin/brs.cli.js --root $PROBE_DIR --deep-link "${PARAMS//&/,}" > $CONSOLE 2>&1
else
    IP=${ROKU_IP:?set ROKU_IP}
    ./pack.sh > /dev/null
    curl -s --digest -u rokudev:${ROKU_PASS:?set ROKU_PASS} -F mysubmit=Install \
        -F archive=@set-port-invalid-probe.zip http://$IP/plugin_install -o /dev/null
    nap 3
    curl -s -d '' http://$IP:8060/keypress/Home; nap 2
    curl -s -d '' "http://$IP:8060/launch/dev?$PARAMS"; nap 2
    # The launch drops console clients: reconnect until the run ends. nc's stdin stays open (at EOF the
    # device hangs up).
    ( while true; do sleep 600 | nc $IP 8085 >> $CONSOLE; nap 0.5; done ) & LOOP=$!
    deadline=$((SECONDS + 120))
    while (( SECONDS < deadline )); do
        tr -d '\r' < $CONSOLE | awk -v r="run=$RUN" 'index($0, r){f=1} f' |
            grep -qE "PROBE\|done|^------ Completed|Backtrace|BrightScript Debugger>" && break
        nap 1
    done
    nap 2
    kill $LOOP 2>/dev/null
    pkill -f "nc $IP 8085" 2>/dev/null
    pkill -f "sleep 600" 2>/dev/null
fi

# The device console replays earlier runs on connect: keep what follows this run's start line, once each.
tr -d '\r' < $CONSOLE | awk -v r="PROBE|start|run=$RUN" 'index($0, r){f=1; delete seen} f && !seen[$0]++' > $OUT/run.txt
grep "^PROBE|" $OUT/run.txt | grep -v "^PROBE|try|" | sed -E 's/^PROBE\|start\|run=[0-9]+/PROBE|start/' > $OUT/trace.txt
echo "Wrote $OUT/trace.txt ($(wc -l < $OUT/trace.txt) lines)"
