#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f sparse-array-probe.zip
zip -r sparse-array-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/sparse-array-probe.zip"
