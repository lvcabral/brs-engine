#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f drawline-probe.zip
zip -r drawline-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/drawline-probe.zip"
