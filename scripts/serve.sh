#!/usr/bin/env bash
# Build frontend and serve the complete local product from one Rust origin.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
if [[ -x "$ROOT/.tooling/cargo/bin/cargo" ]]; then
 export PATH="$ROOT/.tooling/cargo/bin:$PATH" CARGO_HOME="$ROOT/.tooling/cargo" RUSTUP_HOME="$ROOT/.tooling/rustup"
fi
command -v cargo >/dev/null || { echo 'Install Rust stable first.'; exit 1; }
if [[ ! -d frontend/node_modules ]]; then (cd frontend && npm ci); fi
(cd frontend && npm run build)
export EUPRA_WEB_DIST="$ROOT/frontend/dist"
export EUPRA_BIND="${EUPRA_BIND:-127.0.0.1:8787}"
printf 'Opening local product service at http://%s\n' "$EUPRA_BIND"
cd backend
exec cargo run --locked
