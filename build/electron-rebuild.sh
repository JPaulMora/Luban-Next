#!/usr/bin/env bash
# node-gyp 9 still imports distutils, which Python 3.12+ dropped.
# A local venv with setuptools keeps `npm install` and packaging working.
set -euo pipefail

ROOT="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/build/.gyp-python"

if [[ -x "$VENV/bin/python" ]]; then
    VENV_PY="$VENV/bin/python"
elif [[ -x "$VENV/Scripts/python.exe" ]]; then
    VENV_PY="$VENV/Scripts/python.exe"
else
    PY=""
    for candidate in python3.12 python3.11 python3.10 python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            PY="$(command -v "$candidate")"
            break
        fi
    done
    if [[ -z "$PY" ]]; then
        echo "electron-rebuild: python3 is required to build native modules" >&2
        exit 1
    fi
    "$PY" -m venv "$VENV"
    if [[ -x "$VENV/bin/python" ]]; then
        VENV_PY="$VENV/bin/python"
        "$VENV/bin/pip" install -q setuptools
    else
        VENV_PY="$VENV/Scripts/python.exe"
        "$VENV/Scripts/pip.exe" install -q setuptools
    fi
fi

export PYTHON="$VENV_PY"
export npm_config_python="$VENV_PY"

exec npx --no-install electron-rebuild "$@"
