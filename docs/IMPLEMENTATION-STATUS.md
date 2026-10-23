# Implementation status: development checkpoint 0.2

This is a working local product implementation, not full production MVP acceptance. The original handoff remains the target. See `PAGE-COVERAGE.md` for the independently audited 20-page matrix.

## Implemented

- React/TypeScript bilingual application, original supplied branding/media, responsive shared design system and CN core routes.
- Distinct welcome, creation workbench, persisted jobs, private result/source views, historical-version remix selection, searchable/filterable/favoritable works, selected world/creator views.
- Accessible actual parent-child graph, redacted private-ancestor placeholders, server-recorded contribution roles and selected-version URL state.
- Personal profile/settings panels with actual owned-work statistics and server persistence; cinematic video action planner with explicitly prebuilt demo clip; real balance display, policy and FAQ sheets.
- Rust Axum + SQLite, Argon2id authentication, HttpOnly SameSite hashed sessions, bounded authentication attempts, private sanitized JPEG/PNG/WebP uploads.
- Durable idempotent asynchronous jobs; cancellation, terminal failure, startup interruption recovery, owner isolation and rechecked remix permissions.
- Immutable lineage and safe contributor attribution. Revoked/foreign ancestors expose only redacted relationship references, not source inputs or private world memory.
- Configurable complete-engine HTTP adapter and optional staged orchestration. Reality parsing, possibility mining, 12–24 seeds, diversity, judging/ranking, expansion, tournament, visual direction, media, final judgment and safety are typed boundaries. Local mocks verify orchestration, not intelligence.
- Loopback-only opt-in local review of OWN demo text, hashed expiring/revocable share capabilities and authenticated exact-parent continuation. Public preview DTO excludes original source/private memory. Production `HOLD` is unchanged; real/image outputs cannot use this exception.
- Light 4:5 personal poster preview with ALL personal PNG export disabled; optional system-sharing/clipboard only for a server-issued permitted preview link.
- Official-design example poster export, clearly distinguished from private generated output. Private exports remain gated.
- Optional same-origin static frontend serving; unknown API routes never fall back to HTML.
- 100 synthetic engine evaluation cases, offline validation and unscored rubric. No fabricated model or human scores.

## Not production-complete

- No live model or independent multimodal safety provider has been configured/tested. Default creation fails closed. Template demos and original example pictures are never real user generation.
- No actual AI video job, provider billing or success-only daily video-credit settlement.
- No real public publishing/review operation. Local self-review is a development exercise, not moderation approval.
- No GLOBAL feed/comments/follows/notifications/creator economy, payment, KYC or withdrawals.
- No email verification/password recovery, staff moderation interface or comprehensive production abuse defenses.
- SQLite/in-process queue/private local files remain development choices, not production Postgres/Redis/object storage.
- No completed model-quality experiment. 56 evaluation cases still require authorized real photos; no human blind review or retention experiment.
- Local Chromium launch remains blocked, but authorized GitHub CI successfully executed desktop/mobile-viewport Chromium checks on commit `9094403202945e6fb1d1ee577efda46f023640dd`. Later UI changes require their own exact-head run and pixel inspection; current evidence and remaining defects are recorded in `qa/QA-REPORT.md` and `qa/VISUAL-REVIEW.md`. No physical-device, cross-browser or pixel-perfect parity claim.

## Repository and test provenance

Development publication is limited to the user-specified repository's working branch. The default branch contains only a minimal introduction; no merge, deployment or release is authorized. Exact executed results belong in `qa/QA-REPORT.md`; planned tests must not be reported as passed.
