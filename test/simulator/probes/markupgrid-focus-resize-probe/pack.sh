#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f markupgrid-focus-resize-probe.zip
zip -r markupgrid-focus-resize-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/markupgrid-focus-resize-probe.zip"
