# QA report — engineering checkpoints

## First successful CI browser execution

Exact tested commit: `9094403202945e6fb1d1ee577efda46f023640dd`.
Run: https://github.com/sanyexieai/Eupra/actions/runs/39906250531 (success, 2026-10-23 05:34 UTC).

- GitHub-hosted Chromium executed real frontend and Rust API, without API mocks: 18 demo-mode checks and 12 unavailable-mode checks passed.
- 44 full-page screenshots cover desktop 1440×1000 and mobile 390×844, including all CN01–13 core routes in demo mode (CN03 actual terminal cancellation), WEB01 and official example.
- Verified registration, draft/locale retention, generation/immutable continuation, favorite persistence/search/filter, historical-parent selection, local share privacy/login gate, no generated image claims, configured-default refusal, three actual sample inputs and camera file fallback.
- Verified actual downloadable official-example PNG (1080×1500 at this commit). Later fidelity changes require a new run; this does not certify the later 1080×1350 implementation.
- No horizontal page overflow or browser JavaScript runtime errors in those checks. This is desktop Chromium with a mobile viewport, not a physical-device or cross-browser pass.
- Rust 19, component 29, API 5+27, provider/local-sharing security, 15-asset provenance and 13 offline evaluation regression checks also passed in the same CI run.
- Artifact: https://github.com/sanyexieai/Eupra/actions/runs/39906250531/artifacts/12480398320 . Downloaded archive SHA256 `2e3828272795c0f1199b39735f570c28076df8397c14291fd425544d134fa853` (22,136,579 bytes).
- Actual pixel inspection found a too-narrow mobile profile identity column and contradictory cancelled-state copy. Sticky creation controls overlapping the sample heading require viewport/scroll qualification, not a claim of unreachable controls. These were not caught by no-overflow assertions; fixes and a new exact-head run are pending. See `VISUAL-REVIEW.md`.

The first run (`22e09fa`) failed at Rust installer argument parsing before application tests. The toolchain-install command was corrected; no result from that failed run is counted as a pass.

## Latest local follow-on check (2026-10-23 05:39 UTC)

Frontend production build and 41 component tests pass after graph/attribution, 4:5 export preview and visual fixes. New Chinese+English exact-head browser validation is pending; earlier CI certifies only9094403.

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

## Historical first-checkpoint browser limitation (superseded by exact-head CI above)

- At the first checkpoint, actual browser E2E and rendered desktop/mobile visual comparison were **not verified**. Chromium launch was blocked by local socket permissions in this executor; the permitted elevated launch failed in the sandbox launcher. The supported cloud browser cannot open local file URLs and could not reach this executor's isolated localhost. No restriction was bypassed. The error occurred before app browser tests ran.
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
