#!/bin/zsh
set -e
NOTATE_PROJECT_DIR="${0:A:h}"
cd "$NOTATE_PROJECT_DIR"
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
if ! .venv/bin/python -c 'import notate, fastapi' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -e .
fi
print 'Open http://127.0.0.1:8765 in your browser. Press Ctrl+C to stop.'
exec .venv/bin/python -m notate serve "$@"
