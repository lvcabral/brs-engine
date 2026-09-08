#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f callfunc-task-thread-probe.zip
zip -r callfunc-task-thread-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/callfunc-task-thread-probe.zip"
