#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f bitmap-tint-cache-probe.zip
zip -r bitmap-tint-cache-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/bitmap-tint-cache-probe.zip"
