#!/bin/bash
set -x

__dirname="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
electron_version=$(electron --version)

display_usage() {
    npm run electron-builder -- --help
}

if [ $# -le 1 ]; then
    display_usage
    exit 1
fi

if [[ ( $# == "--help") ||  $# == "-h" ]]; then
    display_usage
    exit 0
fi

pushd "$__dirname/../dist/Luban"
echo "Cleaning up \"`pwd`/node_modules\""
rm -rf node_modules
echo "Installing packages..."
# Native addons are rebuilt below with electron-rebuild.sh, which uses
# a Python 3.12+ venv. Skip lifecycle scripts so node-gyp 9 does not
# hit the system Python (no distutils).
npm install --omit=dev --ignore-scripts
npm dedupe --ignore-scripts
popd

echo "Rebuild native modules using electron ${electron_version}"

npm run electron-rebuild -- --version=${electron_version:1} --module-dir=dist/Luban --which-module=font-scanner,serialport

cross-env USE_HARD_LINKS=false npm run electron-builder -- "$@"
