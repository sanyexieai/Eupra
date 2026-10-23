# Eupra Rust backend

A runnable local foundation using Axum, SQLite WAL, Argon2id passwords, hashed opaque cookie sessions, private normalized image uploads, async generation job state, immutable version lineage and account settings.

## Run

Requires stable Rust. From this directory:

```sh
cargo run
# Default: http://127.0.0.1:8787, AI unavailable, durable eupra.sqlite3
EUPRA_PROVIDER=demo EUPRA_DATABASE=/tmp/eupra-demo.sqlite3 cargo run
cargo test
```

`./run.sh` uses the downloaded project-local toolchain if present and otherwise the system Rust toolchain. Frontend must proxy `/api` to this API, with same-origin cookies. `EUPRA_BIND` overrides bind address. Keep loopback for local evaluation. Set `EUPRA_SECURE_COOKIE=1` behind an HTTPS production proxy. Do not expose the development server publicly.

## Truthful capability boundaries

Default AI is unavailable. Explicit demo generates labeled template text, no AI image. Drafts are safety HOLD; production sharing/publishing/export remain blocked. Explicit loopback-only EUPRA_LOCAL_REVIEW=1 permits owner-reviewed demo TEXT previews through expiring/revocable capability links, never real-model/image output. Video is disabled, no successful credits charged. CN community/payment/earnings are not implemented or fabricated. The generic HTTP engine adapter is configurable but no live provider is connected. The V2 stage orchestrator is wired to an optional authenticated staged HTTP adapter and tested with injected/local HTTP mocks; a live stage service, multimodal safety/export review and production queue/storage are release blockers. See PROVIDER.md and the design audit docs.

Uploads accept PNG/JPEG/WebP signatures, cap compressed bytes and decoded dimensions/memory, decode/re-encode to strip EXIF and ancillary metadata, and are served only to the owner with no-store/nosniff. Never share source URLs publicly. Upload routes implement direct local multipart storage instead of production presigned object-storage URLs.

Jobs require idempotency keys, reject key reuse with changed request, are scoped per owner, enforce two active jobs/user, and cancel safely before version commit. Failed/restarted workers do not invent success. Canonical action aliases are supported. All successful demo versions are immediately durable in works; save is idempotent. Parent/root/world/depth are server-derived; parent permission is checked both at enqueue and commit. Version content is never overwritten by continuation. Settings and remix permission are mutable authorization metadata.

## Tests

Rust tests cover unavailable-default, auth-backed core flow, owner isolation, idempotency/conflicting keys, 20 concurrent same-key requests, malformed JSON fields, cancel/no version, disabled video/no charges, share HOLD, root/parent lineage, permission revocation, worker injected storage failure, weighted V2 scoring and fail-closed hard gates/invalid scores. A local mock HTTP test covers the authenticated engine wire contract and output-safety rejection.

External blackbox QA additionally checks private image retrieval/source reuse, metadata stripping, decompression dimensions, queued permission revocation and logout. The parent repository owns that QA harness.

## Production gaps

SQLite and in-process dispatch intentionally replace the specified PostgreSQL/Redis/object-storage infrastructure for local portability. Accounts are local email/password, not verified email or real-name identity. Distributed/IP-aware auth rate limiting, reset/verification, production-wide quotas, origin/CSRF controls at trusted reverse proxy, real moderation/admin review queue, durable job leasing, true video reservation ledger and real provider integrations require implementation before release. Structured V2 contracts and scoring are in src/engine.rs; they do not assert that semantic AI quality or moderation have occurred.

## Local closed-loop development preview

Run EUPRA_PROVIDER=demo EUPRA_LOCAL_REVIEW=1 (bind must be loopback). The author manually approves only their own template-text output, creates an expiring preview link, and a signed-in second account may continue it. The guest sees an explicit development label, no source image, private memory or email. The recipient owns their child, root/parent/contribution IDs remain accurate, and revoking the original link prevents new access/remixes without deleting already-created descendants. Production safety HOLD is never lifted by this flow.

Favorites and world aggregates persist. Independent local review/audit records retain who approved/withdrew or revoked a link. Capability hashes, not raw tokens, are stored. This is not public community, regulatory moderation, an admin account or a permission to export real generated media.

EUPRA_WEB_DIST can point to an absolute built frontend directory for a single-origin local app. Unknown API routes never fall back to HTML. Keep all services local; do not expose the preview server through a public tunnel.

Auth attempts persist (10 per email/15 minutes; global 60/minute), CPU-heavy authentication/upload decoding is bounded and offloaded, and local job capacity is two/user and sixteen overall. These are local safeguards, not distributed production infrastructure.
