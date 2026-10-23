#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f collection-index-probe.zip
zip -r collection-index-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/collection-index-probe.zip"
