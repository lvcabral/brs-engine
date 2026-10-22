#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f type-legacy-probe.zip
zip -r type-legacy-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/type-legacy-probe.zip"
