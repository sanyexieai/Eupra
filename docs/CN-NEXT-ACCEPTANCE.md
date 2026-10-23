# Next CN increment: finite acceptance checklist

Scope frozen: 2026-10-23 08:41 UTC. Baseline application: `18d03563845ea67f6506c48843baa58db2463a1b`; baseline documentation: `c487e18`. This is a prospective eight-item implementation/acceptance plan, not a claim that these items have passed. Existing checkpoint documents remain unchanged.

Only the eight original-backed bundles below are in scope. They use owned assets, existing local-demo capability sharing and actual persisted jobs. They do not require a live model, public publication, public profile exposure or production export approval. References use the exact original-file index at the end; line numbers refer to those supplied Markdown files.

## 1. CN04 actual-source sheet

**Original:** P04 §3 item 4, §4 and §10, lines 43, 66 and 171.

**Actual gap:** `Result` expands an inline source image instead of opening the specified closable source sheet.

**Bounded implementation:** Show only the current work's authorized actual source in a sheet. Preserve the selected result when the sheet closes. A missing, inaccessible or unavailable source must not become example artwork or another creator's source.

**Acceptance:**
- Open a work with an owned source and verify the sheet displays that source, not the result asset or a bundled example.
- Close/reopen without changing the current version or its lineage.
- Missing/denied source has an honest state; foreign source content is never returned or displayed.
- Verify both languages and mobile sheet dismissal/viewport clearance.

## 2. CN08 first-class Draft tab

**Original:** P08 §02 and §05 items 3/10/12, lines 21, 73 and 80–82.

**Actual gap:** Durable drafts exist in a separate expandable management panel, not the library's primary classification.

**Bounded implementation:** Expose All/Original/Remix/Draft in the primary library classification, reusing existing draft persistence and recoverable deletion. Existing optional Favorites/Trash controls need not be removed.

**Acceptance:**
- Switch the four required classifications; active drafts appear only in Draft and never inflate completed-work counts.
- Counts and visible items update after confirmed draft deletion; cancelling confirmation changes nothing.
- Resume a saved photo/text draft with its full persisted input and correct parent.
- Empty/search-no-match states are distinct; switching tabs or reopening the library does not relabel stale work actions as draft actions.

## 3. CN08 work-detail and continuation drawer

**Original:** P08 §02, §04 and §05 items 5–9, lines 22–24, 46 and 75–79.

**Actual gap:** Work cards navigate away instead of opening the prescribed drawer with source relationship and actions.

**Bounded implementation:** Open the selected work in a bottom drawer with actual image/text, parent relationship, favorite, existing CN06 sharing handoff, lineage and direction/continuation entry. Reuse existing jobs and immutable versions rather than inserting fabricated results.

**Acceptance:**
- Opening two different cards shows their respective work IDs/content and correct parent relationships.
- Favorite changes synchronize with the corresponding card; share targets that work's CN06 route.
- Lineage and continuation retain the selected historical parent; a chosen direction creates an actual local-demo job and does not overwrite the parent.
- Closing restores the library with its existing search/filter/sort context; test empty/denied work and mobile drawer clearance.

## 4. Selected-node growth maps, lineage sheet and persistent actions

**Original:** P05 §2, line 11; P09 §2.2/§2.4 and §4.1, lines 11–21 and 33–35; P10 §3 paths B/C and §5, lines 44–59 and 104–107.

**Actual gaps:** CN05 has a strip/link rather than its lightweight growth map. CN09's graph covers ancestors rather than the available branch graph. CN10 lacks the lineage sheet. CN09/CN10 lack the specified persistent CTA, and CN10's continuation still opens another submit screen.

**Bounded implementation:** Reuse actual authorized world/lineage records for the CN05/CN09 maps and CN10 source-to-current sheet. Provide persistent exact-node continuation in CN09/CN10. No public graph, new author data or generated candidate batch is included.

**Acceptance:**
- A branched fixture displays real parent-child edges; selecting a historical node updates its visual, text and selection consistently.
- CN10 opens the selected node's ancestry chain; selecting a chain entry returns to that historical node.
- Continuing from an older node creates a job with precisely that `parent_version_id`, never the newest node by position.
- Private ancestors remain content-free and non-actionable; malformed cyclic input cannot hang traversal or invent ancestry.
- Fixed actions remain reachable without covering content at mobile widths; both languages preserve the selected node.

## 5. WEB original/sample story interaction

**Original:** PW §2 Story Showcase and §4, lines 24 and 49–52.

**Actual gaps:** The original-source card opens the CEO result. Example continuation only alternates CEO/moon rather than the supplied additional example sequence.

**Bounded implementation:** Make the original card present/select the actual sample source and complete the supplied example-story sequence. Keep the existing working example download. This is explicitly a packaged demonstration, not personal generation.

**Acceptance:**
- Original-source interaction shows/selects the supplied source rather than misrouting to a finished CEO result.
- Example continuation changes the selected supplied example, image and corresponding text through the intended sequence, including the additional supplied example.
- Example labels remain visible in both languages; these interactions create no private generation job, no generated asset claim and no quota spend.
- Existing genuine example download and mobile story interaction still work.

## 6. CN07 original/own-version comparison and onward sharing

**Original:** P07 §2.3/§2.4 and §3, lines 18–24 and 30–31. Traceability: P04 §6, line 128.

**Actual gaps:** Original/your-version comparison, save/share handoff and fixed CTA are absent.

**Bounded implementation:** For the existing signed-in local-demo continuation, compare the permission-bearing shared version with the recipient's actually completed child. Preserve exact root/parent and already-permitted creator IDs. Save/share targets the owned child through existing CN06. Do not publish private nickname/avatar fields or implement anonymous generation.

**Acceptance:**
- Before a child succeeds, no fabricated "your version" or success message appears.
- After a real local-demo job succeeds, comparison uses the exact shared parent and actual owned child; their identities are not reversed or replaced by examples.
- Save and re-share hand off the child ID, respecting existing local-preview consent and production-export denial.
- Revoked/expired/mismatched source capability remains unavailable and never exposes source uploads; the recipient's already-owned child retains its existing ownership semantics.
- Fixed CTA remains reachable and context-correct in both languages/mobile layouts.

## 7. CN06 truthful platform-sharing guidance

**Original:** P06 §3.3, lines 20–22; P04 §6, lines 124–127.

**Actual gap:** No platform-aware SDK-or-manual guidance is provided.

**Bounded implementation:** Provide localized guidance for supported native/manual sharing. No platform SDK integration, external posting or new public-sharing capability is required. Personal export remains unavailable until its genuine prerequisites exist.

**Acceptance:**
- Native sharing availability, unsupported environment, cancellation and failure produce accurate feedback, not an invented platform-post success.
- Manual guidance explains only actions actually available for the current content/scope.
- Blocked personal export explains the unavailable prerequisite rather than instructing the user to save a nonexistent poster.
- Existing local-demo link copy/manual fallback still works; platform guidance does not weaken consent or safety boundaries.

## 8. CN03 shared-parent retry recovery

**Original:** P03 §3 error/timeout and §5 retry contract, lines 45–50 and 90–93.

**Actual gap:** Frontend retry always sends `{}` while the backend correctly requires a fresh valid capability for shared-parent requests.

**Bounded implementation:** Provide a way to regain valid share context and retry the exact persisted original request with a new idempotency key. Reuse the existing backend capability checks and source-preserving retry contract; do not reconstruct input from the display excerpt.

**Acceptance:**
- A failed/cancelled shared-parent job retries successfully with a currently valid matching capability and retains full original input/exact parent.
- Missing, revoked, expired or mismatched capabilities fail safely; no replacement parent or success is invented.
- Duplicate submission uses the existing idempotency behavior and does not produce duplicate jobs.
- Raw capabilities are not added to persisted drafts, logs or task/return URLs. The existing share URL remains the capability carrier; do not broaden access or transfer private source ownership.
- Ordinary owned-parent retry, active-job exit guards and terminal reveal remain intact.

## Excluded refinements and blocked gates

- **Persistent link-list screen:** not specified by the originals. P08 §06/§07, lines 86 and 101, requires revocable permissioned links and expiry policy; existing APIs provide those contracts. A durable management screen is optional, not an additional must-have for this increment.
- **Generic per-read retry expansion:** dedicated retry buttons for every read are not named original requirements. The eight flows must handle failures honestly, but this checklist does not authorize an open-ended retry redesign across the product.
- **Public nickname/avatar attribution:** P07 does not require it, and private profile APIs do not authorize publication. Use already-permitted creator/work identifiers for traceability.
- **Personal PNG delivery:** P04 §6, lines 123–128, and P06 §3.1, lines 12–14, require genuine 1080×1350 PNG output. P04 §7, lines 130–137, also requires independent output review/publication permission. Current fail-closed behavior is correct. A new deny-only delivery schema would not complete export. Enabling personal downloads remains blocked pending actual independent review, export authorization and an approved artifact-delivery contract; local owner preview is not approval.
- **Other deferred work:** anonymous generation/abuse policy, genuine 2–4 AI proposals (P05 §4.2), live media/safety, public hosting, staff appeal processing, GLOBAL, payments and deployment. Prototype-only transitions, sample-debug menus and suggested analytics are not extra acceptance blockers.

## Verification and stopping condition

Finish these eight bundles, then run focused component/API/security regressions and an exact-head real-browser pass covering their positive, denied and interrupted flows in Chinese/English desktop/mobile viewports. Actual screenshot review is separate from functional checks. Do not borrow the baseline CI result for changed application code.

Stop when the eight bundles pass and all excluded/gated behavior remains truthful. This does not certify complete design parity, all 20 pages or production readiness. No merge, deployment or public release is part of this checklist.

## Exact original-file index

All paths are relative to `design/extracted/Eupra发生_MVP1.0/`:

- **P03:** `Eupra_V0.2_CN-03/Eupra_CN03_V0.2_Delivery/spec/CN-03_设计与开发标注.md`
- **P04:** `Eupra_V0.2_CN-04/Eupra_CN04_V0.2_Delivery/spec/CN-04_设计与开发标注.md`
- **P05:** `Eupra_V0.2_CN-05_再离谱点_高保真设计与源码完整交付包/Eupra_CN05_V0.2_Delivery/spec/CN-05_设计与开发标注.md`
- **P06:** `Eupra_V0.2_CN-06_分享与导出_高保真设计与源码完整交付包/Eupra_CN06_V0.2_Delivery/spec/CN-06_设计与开发标注.md`
- **P07:** `Eupra_V0.2_CN-07_分享落地H5_高保真设计与源码完整交付包/Eupra_CN07_V0.2_Delivery/spec/CN-07_设计与开发标注.md`
- **P08:** `Eupra_V0.2_CN-08/Eupra_CN08_V0.2_Delivery/spec/CN-08_设计与开发标注.md`
- **P09:** `Eupra_V0.2_CN-09_作品详情_高保真设计与源码完整交付包/Eupra_CN09_V0.2_Delivery/spec/CN-09_设计与开发标注.md`
- **P10:** `Eupra_V0.2_CN-10/Eupra_CN10_V0.2_Delivery/spec/CN-10_设计与开发标注.md`
- **PW:** `Eupra_V0.2_WEB-01/Eupra_WEB01_V0.2_Delivery/spec/WEB-01_设计与开发标注.md`
