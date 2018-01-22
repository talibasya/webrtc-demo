#!/usr/bin/env bash
set -ex

npm install
pushd client
  webpack
popd
