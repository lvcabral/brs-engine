#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f regex-pcre-probe.zip
zip -r regex-pcre-probe.zip manifest source -x '*.DS_Store'
echo "Created $(pwd)/regex-pcre-probe.zip"
