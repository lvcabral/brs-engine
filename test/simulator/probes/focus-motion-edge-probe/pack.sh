#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f focus-motion-edge-probe.zip
zip -r focus-motion-edge-probe.zip manifest source components images -x '*.DS_Store'
echo "Created $(pwd)/focus-motion-edge-probe.zip"
