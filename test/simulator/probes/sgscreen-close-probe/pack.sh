#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f sgscreen-close-probe.zip
zip -r sgscreen-close-probe.zip manifest source components sounds -x '*.DS_Store'
echo "Created $(pwd)/sgscreen-close-probe.zip"
