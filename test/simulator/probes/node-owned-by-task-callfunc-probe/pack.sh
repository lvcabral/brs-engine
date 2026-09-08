#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f node-owned-by-task-callfunc-probe.zip
zip -r node-owned-by-task-callfunc-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/node-owned-by-task-callfunc-probe.zip"
