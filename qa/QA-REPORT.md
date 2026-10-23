# QA report — engineering checkpoints

## Second pass (2026-10-23, before CI)

- Aggregate local check: 19 Rust tests and Rust build; 29 Vitest/jsdom tests and TypeScript/Vite production build passed.
- Independent API smoke still passes: 5 unavailable-default and 27 demo checks.
- 15 shipped original design assets verified byte-for-byte against the recorded source manifest. This proves provenance, not rendered visual fidelity.
- 100 synthetic engine cases validate; 13 evaluation-schema regression tests pass. No provider execution/human blind scores exist; 56 cases await authorized photos.
- Optional staged HTTP engine tested with local mock: stage sequence/request binding, input-safety denial, cancellation and private success. Local mock responses are not evidence of model quality.
- Local-share security regression passed during independent review: token hashing/expiry/revocation, owner-only review, source/private-memory isolation, authenticated exact-parent continuation, permission/review concurrency, favorites isolation and static traversal/API fallback.
- Independent staged review fixed candidate/memory size bounds and authoritative retention of the selected current event; regression fixtures cover omitted history and oversized expansion.
- Browser CI is prepared for the authorized working branch, but no completed runtime browser result is claimed yet.

## First checkpoint evidence (retained)

Date: 2026-10-23 UTC. Scope: local development implementation. No live model, public deployment, payment, or user-production-data test was performed.

## Passed

- Rust backend compiled; 9 Rust tests passed, including auth/lineage/idempotency/ownership, unavailable default, cancellation, terminal worker failure, malformed payload, concurrent duplicate requests, V2 weighted ranking hard gates, HTTP wire validation and private HTTP result persistence.
- Independent default-mode API smoke: 5 checks passed. Generation is unavailable by default, not simulated as success.
- Independent demo-mode API smoke: 27 checks passed. Registered isolated test accounts; session authentication/logout; idempotent tasks; private jobs/versions/worlds; explicit demo text with no fabricated image; correct root/parent/world identifiers; two parallel children from the same historical root retained; persisted works; server-side remix revocation; share safety-HOLD; no deduction for unavailable video.
- Independent provider security script passed against a loopback mock service and isolated database: request binding, input/output safety, redirect rejection, returned-URL rejection, invalid/oversized images and oversized responses, immutable facts, in-flight cancellation and revocation, no orphan versions, sanitized failures and no test-key/query-secret leakage.
- Reviewer HTTP checks verified source-image metadata stripping, MIME/content validation, compressed image dimension bounds, owner-only access and unauthorized source reuse rejection.
- Frontend TypeScript and Vite production build passed. Eight retained Vitest/jsdom tests passed: draft/file preservation across locale/navigation, auth Escape/close/back behavior, unavailable-provider side effects blocked, demo result routing/labeling, mobile navigation DOM/CN community absence and genuine lineage labeling. These are component tests with mocked API responses, not rendered browser tests.

## Not passed / not executed successfully

- Actual browser E2E and rendered desktop/mobile visual comparison are **not verified**. Chromium launch was blocked by local socket permissions in this executor; the permitted elevated launch failed in the sandbox launcher. The supported cloud browser cannot open local file URLs and could not reach this executor's isolated localhost. No restriction was bypassed. The error occurred before app browser tests ran.
- `qa/browser_smoke.py` and `.github/workflows/checks.yml` retain genuine browser checks for an authorized suitable environment. These scripts are not evidence of a pass until they execute successfully.
- Actual source design PNG pixels were inspected, but this is not runtime visual verification of the implementation.
- No real mobile-device, Safari/WebKit, Firefox, accessibility audit, load/soak, network-interruption, provider billing or production penetration test is claimed.
- Real V2 output humor/identity fidelity, 100-case golden evaluation, image/video provider, independent multimodal safety and public sharing remain release gates.

## Regression fixes made during review

1. Reject non-object generation JSON instead of panicking.
2. Recheck idempotency under the insertion lock to prevent duplicate races.
3. Transition storage failures to terminal failed jobs instead of leaving queued tasks forever.
4. Enforce cancellation and current parent permission again when committing provider output.
5. Reject unsafe/mismatched provider output before version insertion.
6. Correct frontend seconds-based timestamps, genuine root labeling, locale alias handling, unavailable generation behavior and auth dialog keyboard dismissal/focus behavior.

## Re-run

- `./scripts/check.sh` runs build/API checks on isolated local test databases.
- `python3 qa/provider_security.py` runs the local mock security suite after backend build.
- `npm test --prefix frontend` runs DOM/component checks.
- `python3 qa/browser_smoke.py demo` and `python3 qa/browser_smoke.py unavailable` run real browser tests in a compatible environment with Chromium/Playwright.

Do not run test-account-creating scripts against production databases. Do not infer full MVP acceptance from this checkpoint.
