#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f animated-image-surface-probe.zip
zip -r animated-image-surface-probe.zip manifest source images -x '*.DS_Store'
echo "Created $(pwd)/animated-image-surface-probe.zip"
