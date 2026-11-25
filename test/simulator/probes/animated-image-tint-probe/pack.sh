#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f animated-image-tint-probe.zip
zip -r animated-image-tint-probe.zip manifest source images -x '*.DS_Store'
echo "Created $(pwd)/animated-image-tint-probe.zip"
