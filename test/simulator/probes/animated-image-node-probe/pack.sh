#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f animated-image-node-probe.zip
zip -r animated-image-node-probe.zip manifest source components images -x '*.DS_Store'
echo "Created $(pwd)/animated-image-node-probe.zip"
