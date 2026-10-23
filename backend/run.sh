#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -x ../.tooling/cargo/bin/cargo ]]; then
  export CARGO_HOME="${CARGO_HOME:-$(pwd)/../.tooling/cargo}"
  export RUSTUP_HOME="${RUSTUP_HOME:-$(pwd)/../.tooling/rustup}"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
exec cargo run "$@"
