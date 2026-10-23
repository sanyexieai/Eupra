#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
if [[ -x "$ROOT/.tooling/cargo/bin/cargo" ]]; then
 export PATH="$ROOT/.tooling/cargo/bin:$PATH" CARGO_HOME="$ROOT/.tooling/cargo" RUSTUP_HOME="$ROOT/.tooling/rustup"
fi
(cd backend && cargo test && cargo build)
(cd frontend && npm ci && npm run build && npm test)
DB_DIR=$(mktemp -d)
PID=''
cleanup() { [[ -z "$PID" ]] || kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT
for MODE in unavailable demo; do
 EUPRA_PROVIDER="$MODE" EUPRA_DATABASE="$DB_DIR/$MODE.sqlite3" EUPRA_BIND=127.0.0.1:18787 "$ROOT/backend/target/debug/eupra-api" >"$DB_DIR/$MODE.log" 2>&1 &
 PID=$!
 python3 - <<'PY'
import urllib.request,time
for _ in range(100):
 try:urllib.request.urlopen('http://127.0.0.1:18787/api/v1/config');break
 except Exception:time.sleep(.1)
else:raise SystemExit('API did not start')
PY
 EUPRA_TEST_API=http://127.0.0.1:18787/api/v1 python3 qa/api_smoke.py
 kill "$PID"; wait "$PID" 2>/dev/null || true; PID=''
done
printf 'Checks passed. Isolated test database/logs: %s\n' "$DB_DIR"
