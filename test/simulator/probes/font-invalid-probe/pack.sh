#!/usr/bin/env bash
# Packs the probe into a sideloadable zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f font-invalid-probe.zip
zip -r font-invalid-probe.zip manifest source components images -x '*.DS_Store'
echo "Created $(pwd)/font-invalid-probe.zip"
