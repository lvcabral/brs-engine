#!/usr/bin/env bash
# Packs the probe into a sideloadable zip (the zip is a build artifact, do not commit it).
set -euo pipefail
cd "$(dirname "$0")"
rm -f observer-dispatch-mutation-probe.zip
zip -qr observer-dispatch-mutation-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/observer-dispatch-mutation-probe.zip"
