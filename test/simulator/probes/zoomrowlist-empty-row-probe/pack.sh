#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f zoomrowlist-empty-row-probe.zip
zip -r zoomrowlist-empty-row-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/zoomrowlist-empty-row-probe.zip"
