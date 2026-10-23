# Engine acceptance evaluation: synthetic v0.1

## Evidence boundary

This is an executable, provider-independent **input-fixture and coverage harness**, not a running model benchmark. As of 2026-10-23 it contains 100 authored synthetic inputs, no real-user corpus, no model-generated candidates, no completed human ratings and no measured product quality. Passing this harness establishes only that fixtures are well formed and cover the stated cases. It does not establish that the engine, moderation, images, humor, persistence or product are production-ready.

Authority: `docs/ENGINE-CONTRACT.md` and supplied design `design/extracted/Eupra发生_MVP1.0/Eupra_荒诞反转引擎_V2.0_核心体验与研发规格_20261020.md`, especially sections 9, 12, 17–19, 23 and 32–33. The contract resolves the public action/state names. V2 proposes 500 golden samples plus approximately 100 challenges. This initial synthetic suite is **not** those 500 collected, labeled golden examples, nor proof of a completed challenge benchmark.

## Run locally

Requires Python 3 standard library only; no network, provider, credentials, installation or services.

```sh
python3 qa/engine_eval/validate.py
python3 -m unittest discover -s qa/engine_eval -p 'test_*.py' -v
# Optional handoff plan, containing requests and null results only:
python3 qa/engine_eval/validate.py --plan /tmp/eupra-engine-plan.jsonl
# Rebuild the exact committed input fixtures:
python3 qa/engine_eval/build_fixtures.py
```

Validator exits 0 for valid fixture schema/coverage, 1 for invalid input. Its output explicitly keeps provider execution and human review `not_run`, and humor, visual quality and production safety `not_assessed`. Do not parse exit 0 as a release gate. The optional plan calls nothing and marks each entry `pending_provider` or `blocked_missing_image`. It is not a production API request: an adapter must translate synthetic context to actual authorized source/version records.

Artifacts:
- `qa/engine_eval/cases.json`: versioned, reviewable case inputs and invariants.
- `qa/engine_eval/build_fixtures.py`: deterministic fixture authorship source.
- `qa/engine_eval/validate.py`: executable schema and coverage validation, optional offline execution plan.
- `qa/engine_eval/test_validate.py`: positive/negative validator regression tests.
- `qa/engine_eval/rubric.json`: unscored evaluation criteria and initial V2 thresholds.

## Coverage and provenance

| Category | Count | IDs |
|---|---:|---|
| Pets | 20 | 001–020 |
| Daily objects and office | 20 | 021–040 |
| Sports and text | 20 | 041–060 |
| Continuation | 15 | 061–075 |
| Comment inspiration | 10 | 076–085 |
| Privacy/safety/distribution | 15 | 086–100 |

All IDs use prefix `eupra-`. There are 44 runnable-as-input synthetic text/context fixtures and 56 image collection briefs. None is a model result. English text and comment cases complement primarily Chinese-language cases; language does not determine market. Case 100 explicitly tests the CN public-distribution feature gate.

A `photo_brief` is an instruction for future asset collection, **not a photo, OCR finding or observed visual description**. `source_asset` is null; these cases cannot exercise source-image fidelity. Do not feed their prose to a model and report an image-conditioned success. Photos must later be collected with rights/consent, private storage, an asset hash and a source access policy, then annotated against what is actually visible. Preserve this baseline, and produce a separate versioned asset-binding manifest instead of silently changing provenance. No supplied design image is presented as a real-user sample. The suite currently uses no image assets at all.

Safety placeholders contain no real identifiers. Collecting actual sensitive/minor/third-party images is not necessary for a first review; prefer authorized staged or appropriately synthetic test assets and record that provenance. Never source an unsafe corpus merely to satisfy these case descriptions.

## Input and context invariants

Every case carries unique ID, synthetic provenance, locale, market, canonical action, mode/source readiness, anchors, prohibited inferences, safety checks and evaluation status. There are no expected funny captions or guessed quality scores.

- First twist: no parent context. Preserve recognizable source anchors without inventing identity, address, health or crime facts. Parser observations must remain separate from later fiction.
- Continuation: exact selected parent and its root/snapshot; retain immutable facts and subject; consequences must be causally connected, not an unrelated reroll or a larger title. Cases 071–072 are seventh-step challenges. Cases 073–075 deliberately distinguish the selected old parent from a newer other branch; newest global state must not leak into the output.
- Comment remix: preserve semantic inspiration but treat the comment as untrusted data, not system instructions. Attribute comment ID/author separately from current creator, retain parent and root. Cases 095, 096 and 099 add privacy, harassment and injection challenges to comment context.
- Privacy and safety: redact unnecessary screenshot/document fields before model submission; block absent/revoked source rights; prevent fabricated damaging claims about real people, harassment, non-consensual intimacy and misleading official/media impersonation. The listed checks are review obligations, not a substitute for risk assessment.
- Moderation: G0 text/comments, G1 source/OCR/privacy, G2 concept/prompt, G3 media, G4 combination, G5 comment+parent, G6 export, G7 distribution. L0 pass, L1 revise/redact then recheck, L2 hold/manual review, L3 reject. Unknown or missing review is never a pass. Specific cases may accept different safe paths under a versioned policy; unsafe content must not reach a draft/public output.
- Persistence: child root/parent/comment lineage, immutable version creation only after successful gates, no dirty version on failure. Schema checks on fixture contexts are not execution tests of these behaviors.

The fixture validator rejects claimed generated outputs, claimed human-review completion, fabricated scores, absent anchors, mislabeled photo readiness, invalid branch snapshots and collapsed attribution. It does not understand images or semantically prove these invariants from generated prose.

## Provider-independent execution protocol (not run)

1. Bind authorized source assets and seed synthetic story worlds in a controlled test tenant. Record fixture/asset/context hashes, authorization and redaction evidence. For missing assets, record `blocked_missing_image`, not a failure or pass of a provider.
2. Use explicit adapters for the candidate pipeline and a single-prompt baseline. Match source inputs, budgets, output formats and safety gates; record differences in calls, tokens, cost and latency. Never expose unsafe baseline content to raters or public channels.
3. Capture module versions (parser, miner, generator, judge, memory, personalization, safety), provider/model/prompt/weight version, seed/randomization configuration, job/concept/version IDs, trace IDs and costs including failed attempts. Version scoring thresholds and penalties. Separate generator and judge roles; score original candidates without silent judge rewriting.
4. Record text-seed counts, diversity categories, top-six selection, top-one/two ranking and final visual plan. Ordinary 18–24 and simple/strong-context 12–18 counts are tunable; when below 15, use a documented scaled allocation rather than claiming three seeds across each of five categories. A large seed count is not evidence of diverse ideas.
5. Capture actual output artifacts and their hashes privately, elapsed time, cost, status, safety review and evidence for each applicable invariant. Keep expected safe outcomes separate from observed outcomes. Provider failure, unavailable, blocked input, safety hold/rejection, cancelled and success remain distinct; never silently drop failed cases from denominators.
6. For successful imagery, review source fidelity, concept match, readability, surprise, caption coherence and deadpan tone against both source and output. Log bounded repairs and fallbacks, not just the successful final attempt. No image means visual quality stays unassessed, even for text-to-image cases.
7. Save run records in a separate run directory/store. Do not overwrite fixture evaluation fields. This harness intentionally has no result importer that could turn a JSON-shaped response into a humor/quality pass.

## Rubric and human blind review (not run)

The eight V2 taste dimensions use 0–5 anchored human or independently identified judge ratings: surprise, relevance, specificity, deadpan, identity fantasy, visual impact, remixability and shareability. A 0 means absent/contradicted; 3 means clearly present but ordinary; 5 means compelling and strongly tied to this input. Each rating needs a short evidence note; missing values are null, never 0 or an imputed pass. Scale weighted mean by 20, then subtract separately configured generic/repeat/cringe/randomness/over-escalation penalties. Penalty magnitudes are uncalibrated and must be recorded per run, not invented here.

Relevance ≥3 and specificity ≥3 are hard gates; visual impact ≥2.5 applies to image output. Safety must pass and source fidelity must be attainable independently of total. The initial bands are ≥84 green, [78,84) pairwise, [72,78) repair, <72 reject. These are design tuning parameters, not measured quality. A judge's self-rating is not human evidence.

Arrange a first 100-case human review using eligible, safely generated paired outputs, blinded as A/B with reproducible randomized side order and hidden provider identity. This review has **not happened**. Record reviewer pseudonym, case/run/output references, language familiarity, side allocation and all five separate responses: A/B/tie/unassessable.

1. Which first makes you laugh?
2. Which feels more specific to this source?
3. Which would you share?
4. Which makes you want another continuation?
5. Which better embodies deadpan reality going wrong?

Collect independent raters rather than treating the model as a person. Set reviewer count, exclusion criteria and primary preference question before collecting ratings; retain disagreement and ties. Track source fidelity and safety separately. Reviewers should not see internal scores first. No output/unsafe output is recorded as blocked or unavailable, with coverage reported; do not pretend all 100 received paired review.

Report baseline preference wins/losses/ties/unassessable, per-category denominators, uncertainty intervals and judge–human preference agreement only from actual observations. Freeze statistical analysis and decision criteria before the run. A small or biased sample cannot establish launch readiness. This suite does not collect behavioral First Hit/One More/share/third-generation/remix events, so it cannot measure their V2 targets (45%/55%/20%/30%/15%).

## Remaining release evidence

- Authorized real-image collection and annotations: not done; all 56 photo bindings missing.
- Actual text/image provider and multimodal moderation executions: not run.
- 100-case human blind evaluation against single-prompt baseline: not run.
- Broader 500-example golden dataset with good/bad candidates, rationale and images: not collected.
- Real seventh-step generated chains, persistence and lineage correctness under live execution: not assessed here.
- Real-user behavioral metrics, safety operations, export labels/metadata and legal/regional compliance: not established by this harness.

Fixture validation passing cannot close any of these gates.
