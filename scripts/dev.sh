#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
if [[ -x "$ROOT/.tooling/cargo/bin/cargo" ]]; then
  export PATH="$ROOT/.tooling/cargo/bin:$PATH" CARGO_HOME="$ROOT/.tooling/cargo" RUSTUP_HOME="$ROOT/.tooling/rustup"
fi
command -v cargo >/dev/null || { echo 'Install Rust from https://rustup.rs first.'; exit 1; }
command -v npm >/dev/null || { echo 'Install Node.js 20+ first.'; exit 1; }
if [[ ! -d frontend/node_modules ]]; then (cd frontend && npm ci); fi
(cd backend && cargo run) &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM
(cd frontend && npm run dev -- --host 127.0.0.1)
