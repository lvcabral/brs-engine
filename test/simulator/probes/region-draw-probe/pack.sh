#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f region-draw-probe.zip
zip -r region-draw-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/region-draw-probe.zip"
