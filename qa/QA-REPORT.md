# QA report — engineering checkpoints

## Latest tested application revision: final v0.4 visual refinement

Exact tested application commit: `aeb203ccd8ae05a06dcb58e6ac7ccdebd3d5e3c8`.
Run: https://github.com/sanyexieai/Eupra/actions/runs/39916874949 (success, 2026-10-23 07:22 UTC).

- 24 Rust and 69 component tests; API 5+27 checks; provider/local-share/private-asset security; 18-asset provenance (16 originals plus 2 compatibility derivatives); 13 offline evaluation regressions passed.
- 29 demo + 19 unconfigured real-browser checks passed, with 61 + 28 bilingual desktop/mobile-viewport captures. The final pale route chrome, website-only footer, settings header/navigation and mobile WEB content ordering are included in this exact application revision.
- Artifact 12485641629 was downloaded and SHA256 verified: `16b2abed3feb01760e2f9705dcaafaa338f29b4a6a8905c9eb4f1d6902a5fa3e`, 48,233,238 bytes. `qa/DESIGN-FIDELITY.md` separates actual pixel review from functional acceptance.
- Following documentation-only updates do not change application code. Do not transfer this pass to future code changes. Real models, quality, independent safety, production public sharing/export, video billing, deployment and GLOBAL remain unaccepted.

## Previous v0.4 CN recovery-loop checkpoint

Exact tested commit: `4ac763c494e604b684644d58d0966e26e10fa19e`.
Run: https://github.com/sanyexieai/Eupra/actions/runs/39915775683 (success, 2026-10-23 07:11 UTC).

- 24 Rust and 64 component tests; API 5 unavailable + 27 demo checks; provider, local-share and private-asset security; 13 offline evaluation regressions passed.
- 29 demo + 19 unconfigured real-browser checks passed with 61 + 28 Chinese/English desktop/mobile-viewport captures. Real flows include private text/photo draft persistence across reload, anonymous source denial, recoverable draft/work deletion, child-lineage preservation, permanent old-link revocation after restore, full-source terminal-job retry and actual original-demo video playback without spending credits.
- 18 shipped media files verify against the manifest: 16 byte-identical original assets plus 2 documented WebM derivatives for Chromium playback. They are never substituted for a user's generated output.
- Artifact 12484992103: 49,530,872 bytes; GitHub digest SHA256 `dd7e5280f06bb6466c1a1826c259679879a8da9c556e5bca766230948e25af98`.
- Subsequent pale route chrome, responsive WEB ordering and duplicate-caption fixes pass 69 local component tests and build. They await a separate exact-head CI; this result must not be transferred to those changes.
- Previous v0.4 runs exposed genuine MP4 compatibility, English draft-locale and test-selector issues, all corrected before this run. An unrelated slow Ubuntu package mirror caused a 20-minute timeout; bounded official-mirror installation now succeeds. No failed run counts as an acceptance pass.
- Live providers, model quality, independent safety, personal media export, production public sharing, payments, deployment and GLOBAL remain unaccepted. Physical-device/cross-browser and pixel-perfect parity are not claimed.

## Previous v0.3 tested application revision

Exact tested commit: `b611fcaace859484cc57977d795c4d0c78eedf16`.
Run: https://github.com/sanyexieai/Eupra/actions/runs/39908730333 (success, 2026-10-23 06:02 UTC).

- 19 Rust, 43 component tests, API 5+27 checks, provider/local-share security, 15 original assets and 13 offline evaluation regressions passed.
- 21 demo + 14 unconfigured real-browser checks passed, with 61 + 28 Chinese/English desktop/mobile-viewport captures. This includes the clarified unavailable production-review state. The Chinese mobile export screenshot was directly inspected and correctly says no moderation task is running.
- Artifact 12482290600: 42,061,436 bytes; SHA256 `12affa900b95fa67b103f63c6830c7c8435380f5f92b439f1bca03b8c1f9aa43`.
- The following documentation-only checkpoint does not change application code. Earlier evidence below is retained with its own exact commit; no claim of live-provider or full-MVP acceptance is made.

## Bilingual core acceptance checkpoint

Exact tested commit: `0d235b280650b9f2da7537b639d12444b0e9cd25`.
Run: https://github.com/sanyexieai/Eupra/actions/runs/39908362744 (success, 2026-10-23 05:58 UTC).

- 19 Rust and 42 component tests; API 5 unavailable + 27 demo checks; provider/local-sharing security; 15 original-asset checks and 13 offline evaluation regressions passed.
- Genuine Chromium against the Rust API passed 21 demo and 14 unconfigured-service checks. 61 demo and 28 unconfigured captures cover Chinese/English at desktop 1440×1000 and mobile viewport 390×844. These are not physical-device tests.
- Confirmed exact historical parent/query selection, immutable continuation, safe local demo sharing, Chinese-input template result, actual 1080×1350 official-example PNG, all three actual sample inputs, dismissible sample notification and unobstructed sample/footer hit targets, file-input camera fallback, no horizontal overflow or JavaScript runtime errors.
- Artifact 12481354728: 42,052,068 bytes, SHA256 `bfa4822f9dba38f458c5ac98993b07660d2b1a464bb3f79dc159411715015dc5`.
- Production review/publishing copy was clarified afterward in `b611fca`: it explicitly states services are not configured and no moderation job is running. The additional component regression passes locally (43 total); that separate exact-head CI subsequently passed, as recorded above.
- All demo generations are explicit template text with no fabricated image. Live providers, model quality, independent safety, public sharing, payments and deployment remain unaccepted. See the all-page matrix and visual review for design gaps.

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
- Actual pixel inspection found a too-narrow mobile profile identity column and contradictory cancelled-state copy. Sticky creation controls overlapping the sample heading require viewport/scroll qualification, not a claim of unreachable controls. These were not caught by no-overflow assertions; the later bilingual checkpoint above validates the fixes and strict sample/footer hit targets. See `VISUAL-REVIEW.md`.

The first run (`22e09fa`) failed at Rust installer argument parsing before application tests. The toolchain-install command was corrected; no result from that failed run is counted as a pass.

## Latest local follow-on check (2026-10-23 05:39 UTC)

Frontend production build and 41 component tests pass after graph/attribution, 4:5 export preview and visual fixes. This historical local checkpoint is superseded by the bilingual CI evidence above.

## Second pass (2026-10-23, before CI)

- Aggregate local check: 19 Rust tests and Rust build; 29 Vitest/jsdom tests and TypeScript/Vite production build passed.
- Independent API smoke still passes: 5 unavailable-default and 27 demo checks.
- 15 shipped original design assets verified byte-for-byte against the recorded source manifest. This proves provenance, not rendered visual fidelity.
- 100 synthetic engine cases validate; 13 evaluation-schema regression tests pass. No provider execution/human blind scores exist; 56 cases await authorized photos.
- Optional staged HTTP engine tested with local mock: stage sequence/request binding, input-safety denial, cancellation and private success. Local mock responses are not evidence of model quality.
- Local-share security regression passed during independent review: token hashing/expiry/revocation, owner-only review, source/private-memory isolation, authenticated exact-parent continuation, permission/review concurrency, favorites isolation and static traversal/API fallback.
- Independent staged review fixed candidate/memory size bounds and authoritative retention of the selected current event; regression fixtures cover omitted history and oversized expansion.
- At this historical pre-CI checkpoint no completed runtime browser result existed; subsequent exact-head evidence is recorded above.

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

## Subsequent CN functional increment: local only

28 Rust and 89 component tests/build pass. Provider, local-share, private-asset and new personal-control security scripts pass against isolated local databases. New checks cover profile/avatar ownership and malformed fields, safe account aggregates, immutable motion preferences, deleted-work denial, bounded private pending_local appeals, settings isolation and truthful disabled quota policy metadata. Browser harness now checks deliberate reveal, direct continuation, child navigation, query/filter/world search persistence, private profile/avatar, local appeal records and saved motion ideas. No runtime browser pass is claimed yet for this increment.

### v0.5 CI-found navigation readiness defect

Run 39919977254 at `92264dd71ffaf360fae6a2adef3250aeaa26af1b` passed 28 Rust tests/build but failed one of 88 component tests: immediate Back after a running job became visible bypassed the page-local blocker before its passive registration/update effect. Browser suites were skipped; this is not a browser pass. The guard was moved to the persistent app router with current-status references and protection during unknown/loading status. Regression coverage retains refusal and acceptance assertions, with a pending-status case and a real-browser deferred-dispatch check (server responses are not fabricated).

Guard fix verification: official Node 22.23.4 passed 20 repeated focused history/pending-status test runs, all 89 UI tests and TypeScript/Vite build. No navigation assertion was removed or relaxed and no arbitrary delay was added. Exact new-head CI remains required.

Following browser runs verified direct continuation, branch return, retained world search, real Back/reload protection and private profile/avatar preferences. They exposed harness distinctions between asynchronous filter navigation and full-document versus SPA history, and an appeal select missing an explicit exact accessible label. The label binding and regression were fixed. New intermediate-state screenshots are included in the next run; no overall v0.5 browser pass is claimed until both modes complete.
