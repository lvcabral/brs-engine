#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f rendezvous-probe.zip
zip -r rendezvous-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/rendezvous-probe.zip"
