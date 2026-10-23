#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f numeric-args-probe.zip
zip -r numeric-args-probe.zip manifest source images -x '*.DS_Store'
echo "Created $(pwd)/numeric-args-probe.zip"
