#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f grid-focus-layer-probe.zip
zip -r grid-focus-layer-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/grid-focus-layer-probe.zip"
