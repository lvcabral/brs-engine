#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f rowebsocket-probe.zip
zip -r rowebsocket-probe.zip manifest source components images -x '*.DS_Store'
echo "Created $(pwd)/rowebsocket-probe.zip"
