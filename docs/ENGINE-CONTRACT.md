# Eupra engine integration contract

Audit date: 2026-10-23. This is a design-to-engineering contract, not a claim of live model or safety integration. Source documents are in `design/extracted/Eupra发生_MVP1.0/`.

## Authority and compatibility

- `Eupra_MVP1.0_研发交接总包_20261020.md` governs canonical domain entities, public API names, market gates, quota and release acceptance.
- `Eupra_荒诞反转引擎_V2.0_核心体验与研发规格_20261020.md` is the latest detailed generation design. Its explicit V2 changes replace V1 candidate counts, ranking and memory guidance. Its abbreviated API/status examples must not accidentally replace the more precise handoff state machine.
- `Eupra_引擎_2026.md` contains V1 dated 2026-10-14, including detailed G0–G7 safety requirements retained where not superseded. Its image quota is obsolete.
- Rust is an implementation choice compatible with these contracts. Keep provider calls separate from domain/orchestration; the sample TypeScript directories are not a requirement to change language.

Canonical public actions map to V2 internal types:

| Public action | Internal type | Required context |
| --- | --- | --- |
| MAKE_IT_HAPPEN | FIRST_TWIST | Authorized source asset and/or text |
| PUSH_FURTHER | REMIX | Exact selected parent version |
| COMMENT_TO_VERSION | COMMENT_REMIX | Parent, root, comment and comment author |
| VIDEO_5S | VIDEO_5S | Existing successful version |

Use `POST /api/v1/generation-jobs`, `GET /api/v1/generation-jobs/{id}`, and cancellation as the canonical public contract. V2 `/generations` and `/versions/{id}/remix` examples may be explicit compatibility adapters, not separate inconsistent models.

## Pipeline

1. Intake: validate action/input, market feature flags, authorization, idempotency and abuse limits.
2. Safety and rights precheck; minimize input, remove unnecessary EXIF and redact sensitive screenshot fields before model submission.
3. Reality Parser: facts and recognizable anchors, subjects, objects, tensions, `must_preserve`, `must_not_infer`. Do not invent identities.
4. Possibility Miner: identity, desire, rule, world, agency and hidden tension axes.
5. Seed Factory: configurable 18–24 inexpensive text seeds for ordinary inputs, 12–18 for simple or strong-context continuation. Not 18–24 image calls.
6. Diversity and repeat filtering; initial categories span power/identity, rules, objects, world, desire/cost. The specification asks three seeds per five categories, which cannot all fit the lower 12-seed setting: scale category allocation explicitly while preserving diversity instead of enforcing contradictory counts.
7. Taste round 1 → top six; expand specific consequences, visual scene and next hook; round 2/pairwise → top one or two.
8. Visual Director: turn the selected concept into one clear visual center, recognizable source subject, specific action, cinematic/deadpan tone. Do not ask the image model to invent the story or render long UI text.
9. Image adapter generation/edit; final multimodal quality judge; targeted bounded repair or candidate fallback.
10. Output safety review before any user draft; AI labeling/export checks; atomically persist a valid immutable Version and its branch state.
11. Return truthful job status and audited result. Saving, sharing and publishing remain distinct actions.

An absent provider must produce an explicit unavailable/blocked result, or run only in an unmistakably marked local demo mode. A stock asset, motion poster, rule-based title, static score or keyword test is not evidence of live AI generation or production moderation.

## Structured module outputs

- Parser: source ID, input mode, locale, literal scene, subjects/traits, objects, social context, mood, tensions, opportunities, preserve and prohibited-inference lists.
- Candidate: concept/source/parent IDs; genes and possibility axis; `anchor`, `twist`, `payoff`, `hook`, `caption`, visual scene, `next_seed`; eight taste scores, penalties and final score.
- VisualPlan: composition, camera, reference-subject fidelity, setting, primary action, supporting objects, tone, text/logo policy and visual joke.
- WorldState: world/root/current IDs, identity, immutable facts, current state, running jokes, open/resolved loops, recent genes and banned repeats.
- Job trace: parser/miner/generator/judge/memory/personalization/safety versions, selected concept, provider/model/prompt/weight versions, latency and complete cost trace.

Validate schema and length boundaries before advancing. Generator, judge, expander and visual director have separate responsibilities; a judge must not silently rewrite the candidate it scores.

## Taste is not safety

Scores are 0–5: Surprise .18, Relevance .14, Specificity .14, Deadpan .12, Identity Fantasy .10, Visual Impact .10, Remixability .10, Shareability .12. Convert the weighted score to 0–100, then apply configured generic/repeat/cringe/randomness/over-escalation penalties.

Hard gates regardless of total: relevance ≥3, specificity ≥3, visual impact ≥2.5 for images, passed safety, attainable source fidelity. Initial experiment bands: ≥84 green; 78–83 pairwise; 72–77 repair; <72 reject. These thresholds and seed counts are versioned tuning parameters, not promises or learned quality.

Final judge separately checks concept match, source fidelity, readability, surprise, caption/image coherence, brand tone and safety. Low match → redraw; low fidelity → strengthen edit/reference constraints; low surprise → next candidate; caption mismatch → rewrite or targeted repair; failed safety → no draft.

## Continuation and lineage invariants

First twist discovers an unexpected world; continuation develops the selected world rather than generating unrelated random content. Use consequences, counterparties, hidden controllers, institutionalization, mundane pullback, cost of wish, perspective flip or second-order twist. Avoid repeating titles/genes, losing the subject, violating established facts or merely increasing scale.

Persist a branch-local WorldState snapshot per Version. Selecting an old parent must inherit that parent's state, not the globally newest node. A root has `root_version_id = id`, `parent_version_id = null`. Every child inherits parent's root and uses the exact parent ID. Comment remix also records comment ID, comment author and current creator as distinct roles. Reject cycles, inaccessible parents and revoked remix rights. Do not cascade-delete descendants when a parent is held/removed. Public lineage never discloses private source photos, location or review evidence.

## Safety and distribution

Required review objects: G0 user text/comments; G1 source image/OCR/privacy; G2 concept/prompt; G3 generated media; G4 combined image/title/caption; G5 comment plus parent context; G6 final exported poster/video; G7 distributed content, reports and appeals.

Decisions: L0 pass; L1 redact/rewrite then recheck; L2 hold/manual review or no public distribution; L3 reject. Missing/failing review must never become automatic approval for high-risk public content. Preserve policy version, risk category, decision, operator evidence and safe user-message key. Do not disclose private rule contents to clients.

Explicit risks include minors, non-consensual intimate content, real-person defamation or fabricated crime/health facts, misleading political/official impersonation, private identifiers/locations, copyright/likeness, harassment and region-specific prohibited content. Deadpan fictional announcements must not look like authentic official news: no real media logos/seals; clear fictional/AI context.

Export requires visible AI labeling and applicable file-level metadata plus generation/model/label audit linkage. A visible badge alone does not prove regulatory compliance. Production must validate current applicable legal requirements separately; this document reports package requirements, not a legal assessment.

Minimum operations: report, review queue, hold, remove, disable remix, limit distribution, restore, appeals and role-controlled audit. Source assets private by default; account/guest permissions enforced server-side. CN disables public feed/comments/follows/economy/public publishing. Locale is not permission to change market.

## Job state and failure behavior

Preserve precise statuses: REQUESTED → INPUT_REVIEWING → PLANNING → MEDIA_GENERATING → OUTPUT_REVIEWING → DRAFT_READY → READY_FOR_USER. Branches include REJECTED_INPUT, HOLD_INPUT, CONCEPT_FAILED, MEDIA_FAILED, HOLD_OUTPUT, REJECTED_OUTPUT and CANCELLED. Later saved/shared/publication/distribution states must not masquerade as generation success.

Clients display real phases, not timed fictional progress. Recovery on refresh returns the same job. Retry policy is bounded; same idempotency key returns the original effect, while an explicit new attempt can receive a new key. Failure creates no dirty Version. Distinguish authorization, input safety, model failure, timeout, output safety, storage, cancellation and system errors.

## Video ledger

Exactly five seconds from an existing valid Version: setup 0–1.5s, twist 1.5–3.5s, payoff 3.5–5s. Preserve source version, creator and generation job.

Free allowance: two successful videos per server-defined account business day. Reserve atomically, commit only after a compliant accessible video exists; release on failure, timeout, rejection or confirmed cancellable-stage cancellation. Repeated callbacks/requests cannot double charge. Concurrent reservations count against availability; do not let a third concurrent job bypass the cap. Persist ledger business date/timezone and handle midnight/restarts consistently. Images/text/remixes never consume this balance.

Membership prices, extra credits, audio, providers and payment/settlement policies remain configurable and unconfirmed. No fake payment success, unlimited-video pledge or withdrawable demo money.

## Evaluation and rollout gates

V2 proposes 500 golden examples plus approximately 100 challenge cases (one later DoD line loosely says 500 Golden/Challenge; retain the explicit planned counts). Cover pets, authorized selfies, offices, exercise screenshots, food/objects, text and comment remixes; repeated seventh-step branches and sensitive edge cases belong in challenge regression.

Pairwise human preference must beat a single-prompt baseline; self-scoring alone is insufficient. V2 target metrics: First Hit ≥45%, One More ≥55%, three-generation ≥30%, organic share ≥20%, remix conversion ≥15%. These are challenge goals, not measured performance. Event records link job/version/concept/judge/genes/user or anonymous ID/locale/market. Never count viewing preset examples as model success.

Personal Weirdness starts with global priors, then lightweight reranking only after meaningful signals. Do not infer health, politics, religion, sexuality or race. Production launch remains blocked until real provider, multimodal safety, persistence, authorization, export and human evaluation evidence exist.
