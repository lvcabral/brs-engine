#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f float-precision-probe.zip
zip -r float-precision-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/float-precision-probe.zip"
