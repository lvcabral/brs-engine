#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f alias-component-scope-probe.zip
zip -r alias-component-scope-probe.zip manifest source components -x '*.DS_Store'
echo "Created $(pwd)/alias-component-scope-probe.zip"
