#!/usr/bin/env bash
set -ex

npm install
pushd client
  node ../node_modules/webpack/bin/webpack.js
popd
