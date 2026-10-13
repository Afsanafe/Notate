#!/bin/zsh
set -e
NOTATE_PROJECT_DIR="${0:A:h}"
cd "$NOTATE_PROJECT_DIR"
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
if ! .venv/bin/python -c 'import notate, webview, fastapi' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -e '.[desktop]'
fi
exec .venv/bin/python -m notate desktop "$@"
