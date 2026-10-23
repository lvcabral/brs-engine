#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f bytearray-enum-probe.zip
zip -r bytearray-enum-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/bytearray-enum-probe.zip"
