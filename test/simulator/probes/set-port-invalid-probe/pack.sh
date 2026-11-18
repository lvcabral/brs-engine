#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f set-port-invalid-probe.zip
zip -r set-port-invalid-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/set-port-invalid-probe.zip"
