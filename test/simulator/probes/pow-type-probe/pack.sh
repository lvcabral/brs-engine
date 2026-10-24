#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f pow-type-probe.zip
zip -r pow-type-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/pow-type-probe.zip"
