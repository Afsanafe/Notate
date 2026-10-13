#!/usr/bin/env bash
set -euo pipefail
NOTATE_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$NOTATE_PROJECT_DIR/scripts/start.sh" desktop "$@"
