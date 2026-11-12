#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f rowlist-hero-grid-probe.zip
zip -r rowlist-hero-grid-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/rowlist-hero-grid-probe.zip"
