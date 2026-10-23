# Implementation status: development checkpoint 0.4

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
- Loopback-only opt-in local review of OWN demo text, hashed expiring/revocable share capabilities and authenticated exact-parent continuation. Public preview DTO excludes original source/private memory. Production `HOLD` means not cleared for publication, not a queued moderation job. Production review/publishing are unconfigured; real/image outputs cannot use this exception.
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
- Local Chromium launch remains blocked. Authorized GitHub CI passed exact commit `aeb203ccd8ae05a06dcb58e6ac7ccdebd3d5e3c8`, run 39916874949: 24 Rust, 69 component and 29+19 real-browser checks, 89 bilingual desktop/mobile-viewport captures. Final chrome refinements are included in that exact tested application revision. No physical-device, cross-browser or pixel-perfect parity claim. See `qa/QA-REPORT.md` and `qa/DESIGN-FIDELITY.md`.

## Repository and test provenance

Development publication is limited to the user-specified repository's working branch. The default branch contains only a minimal introduction; no merge, deployment or release is authorized. Exact executed results belong in `qa/QA-REPORT.md`; planned tests must not be reported as passed.

## CN core follow-on (accepted at the exact revision above)

Private creation drafts now persist full text and private source references with optimistic revision checks, owner-only reads and recoverable trash. Works can be moved to trash/restored without rewriting immutable lineage; deletion revokes preview links and suppresses pending child commits. Old capabilities are not revived by restore. A server-owned retry endpoint reuses the complete original input only for failed/cancelled jobs and rechecks all permissions. Export permission is an explicit owner-only fail-closed contract, not a review queue.

Frontend adds actual welcome file/camera handoff, saved-draft resume, trash/restore management, confirmed cancellation, honest terminal state, source-preserving retry, current-work video/quota navigation and privacy-preserving unavailable-share messages. These functional loops passed the exact v0.4 browser run above. Original-asset layout is compared page by page in `qa/DESIGN-FIDELITY.md`. Pale route chrome/mobile WEB refinements passed the subsequent exact application CI aeb203, as recorded above.

## Next CN functional increment (local verification, CI pending)

Active jobs now guard in-app history/navigation and browser unload; successful jobs wait for deliberate reveal. Results offer a direct exact-parent continuation, real existing-child browsing and return to the selected result. Library query/filter/sort survive reload and include world-name search plus direct graph navigation. Creator overview uses owned account-wide data rather than a fabricated one-world count.

Private profile editing stores bounded nickname/bio and an owner-only normalized avatar. Settings reconcile the account locale and persist explicit changes. Notification preference is storage only, not a subscription. Appeals are actual private local records marked pending_local with staff processing disabled; they never change safety/export. Motion ideas persist separately per owned active version without modifying immutable artwork or spending credits. Balance displays actual disabled-service availability and UTC policy reset metadata, not a promise of future video access.

28 Rust tests, 88 UI tests/build and four independent security suites pass locally. Updated real-browser checks are prepared but have not yet run for this increment. The preceding aeb203 application result does not certify this new code.
