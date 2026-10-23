#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f nan-format-probe.zip
zip -r nan-format-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/nan-format-probe.zip"
