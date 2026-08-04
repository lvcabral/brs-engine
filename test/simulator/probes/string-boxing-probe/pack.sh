#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f string-boxing-probe.zip
zip -r string-boxing-probe.zip manifest source components locale -x '*.DS_Store'
echo "Created $(pwd)/string-boxing-probe.zip"
