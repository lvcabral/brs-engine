#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f timer-control-probe.zip
zip -r timer-control-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/timer-control-probe.zip"
