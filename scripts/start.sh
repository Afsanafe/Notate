#!/usr/bin/env bash
set -euo pipefail

NOTATE_MODE="${1:-}"
case "$NOTATE_MODE" in
  desktop|browser|both) shift ;;
  *) printf 'Usage: %s desktop|browser|both [options]\n' "$0" >&2; exit 2 ;;
esac

NOTATE_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$NOTATE_PROJECT_DIR"

if [[ ! -x .venv/bin/python ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    printf 'Install Python 3.11 or newer, then run this launcher again.\n' >&2
    exit 1
  fi
  python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else "Notate requires Python 3.11 or newer.")'
  python3 -m venv .venv
fi

NOTATE_IMPORTS='import cryptography, notate.app'
NOTATE_PACKAGE='.'
if [[ "$NOTATE_MODE" != browser ]]; then
  NOTATE_IMPORTS='import cryptography, notate.app, webview'
  NOTATE_PACKAGE='.[desktop]'
fi
if ! .venv/bin/python -c "$NOTATE_IMPORTS" >/dev/null 2>&1; then
  printf 'Installing Notate dependencies…\n'
  .venv/bin/python -m pip install -e "$NOTATE_PACKAGE"
fi

exec .venv/bin/python -m notate "$NOTATE_MODE" "$@"
