# Runtime visual review: baseline and targeted recheck

Reviewed 2026-10-23 UTC. This is an actual pixel review of downloaded runtime screenshots, not a filename or source-code-only inspection. No application source was edited and no browser was launched for this review.

## Latest targeted recheck: `0d235b2`

Reviewed actual pixels on 2026-10-23 UTC from successful CI https://github.com/sanyexieai/Eupra/actions/runs/39908362744, extracted under `eupra-product-deliverables/ci-0d235`. This recheck covers only the 12 PNGs listed below, not every screenshot in that run. The associated browser reports contain 21 demo-mode and 14 unavailable-mode checks; those reports are separate functional evidence, not a visual-compliance certificate.

The subsequent safety-HOLD wording change `b611fca` is **not** represented by these pixels. No screenshot finding below certifies that later wording or any later head.

### Observed improvements against `9094403`

- **CN-11 mobile identity: prior P2 resolved at the reviewed 390px width.** Chinese demo and unavailable captures show a compact identity row with a single ellipsized email, a normally wrapping subtitle and the account-information action beneath. The former six-fragment email column is gone. Real zero counts/empty recent-work state remain in unavailable mode, and the collage explicitly says it is design illustration, not the user's work.
- **CN-03 cancellation copy: prior contradictory promises resolved in the Chinese mobile capture.** The screen now explicitly says the server confirmed cancellation, no result is being generated, and the task has stopped. It retains a restart action. A partially filled progress strip and generic generation-timing footer remain as P3 terminal-state polish, but no longer override the clear stopped-state messages.
- **CN-02 unavailable notice: prior P2 proximity problem resolved.** The notice is immediately above the creation button, rather than isolated at the panel bottom. The action is still visually prominent rather than styled as unavailable; keep its refusal behavior clear. The evidence supports the proximity fix, not a claim that every status is visible in the initial viewport.
- **CN-02 sample/CTA overlap: resolved at the inspected scrolled viewport.** Both dedicated sample-viewport captures show all three sample choices, their labels, the sample disclaimer and creation action unobscured above the bottom navigation. The CTA is after the sample section, not crossing its heading. The browser reports additionally record hit-test accessibility of scrolled sample buttons and the final footer control, and dismissal of the sample-confirmation notice. Full-page images still depict fixed navigation across intermediate document content; that capture effect is not itself a new clipping failure.
- **CN-06 consent readability:** Chinese mobile/desktop and English mobile show the local-preview explanation and checkbox consent in a dark purple tone on a very pale panel. The operational consent is visually readable and not styled like the faint disabled action below it. This is pixel-based qualitative confirmation, not a numeric contrast or WCAG audit. Public export remains visibly disabled; the poster identifies a text-only version and local preview is distinguished from public publication.
- **CN-10 desktop relationship presentation:** a visible two-node parent/child connector graph, current-node highlight and separate creator-contribution roles now complement the existing version cards/timeline. The reviewed graph fits the desktop panel without page clipping. This only demonstrates the pictured two-node case, not large-tree or arbitrary-branch usability.

### Remaining design differences and bounded polish

- The design family is recognizable, especially the new light-gradient CN-06 poster/share surface and CN-10 relationship sections, but typography, global shell, proportions and desktop layout are still adaptations. The runtime correctly substitutes labelled text-only content for the original's illustrated generated works; that intentional honesty difference is not a missing-image defect.
- CN-06's mobile poster preview cuts the long English fixture title after “formal”; the desktop preview includes the final word “complaint”. The title does not display an obvious ellipsis at the mobile cutoff. Prefer wrapping or a clear truncation treatment for long titles, without implying that this disabled personal-export preview proves an exported poster is correct. Supporting export/status captions remain small and pale even though consent copy is now darker.
- CN-10's mobile graph shows the root and only part of the second node within its own viewport. A clear horizontal-scroll affordance or initial fit-to-view would make this easier to discover. Static pixels do not establish whether the hidden part is unreachable; the desktop graph and textual lineage remain visible alternatives.
- The pictured Chinese pages contain English work titles/body text because these captures display the earlier English demo fixture. This is not, by itself, evidence of untranslated Chinese interface labels. The run's separate browser report records a Chinese-input localized-result check; this reviewer has not visually inspected that separate result PNG.
- No new screenshot-only P0/P1 defect was established. Narrower 320/375px layouts, long localized content beyond the pictured fixtures, full focus traversal, physical devices, other browsers and a measured accessibility audit remain outside this recheck. This is **not full MVP acceptance**, live AI validation or pixel-perfect sign-off.

### Latest PNGs actually inspected

- `CN-02-mobile-zh-CN-demo.png`
- `CN-02-mobile-zh-CN-unavailable.png`
- `CN-02-mobile-samples-viewport-demo.png`
- `CN-02-mobile-samples-viewport-unavailable.png`
- `CN-03-cancelled-mobile-zh-CN-demo.png`
- `CN-06-mobile-zh-CN-demo.png`
- `CN-06-desktop-zh-CN-demo.png`
- `CN-06-mobile-en-US-demo.png`
- `CN-10-desktop-zh-CN-demo.png`
- `CN-10-mobile-zh-CN-demo.png`
- `CN-11-mobile-zh-CN-demo.png`
- `CN-11-mobile-zh-CN-unavailable.png`

Additional original PNGs inspected for this recheck: `CN-06_mobile_zh-CN.png`, `CN-10_world_zh-CN.png`, `CN-10_lineage_zh-CN.png`, from their supplied design ZIPs. The supplied CN-06 Chinese preview itself contains missing-glyph boxes, so it supports composition comparison, not exact Chinese text fidelity. Earlier reference inspections remain listed in the baseline section below.

## Baseline evidence and scope: `9094403`

- Tested head: `9094403202945e6fb1d1ee577efda46f023640dd`.
- CI: https://github.com/sanyexieai/Eupra/actions/runs/39906250531
- Artifact: https://github.com/sanyexieai/Eupra/actions/runs/39906250531/artifacts/12480398320
- Runtime evidence directory: `eupra-product-deliverables/ci-9094403` (sibling of the project directory).
- Inspected all 36 CN runtime PNGs listed below: 26 demo-mode images and 10 unavailable-mode images. Desktop viewport was 1440×1000; mobile viewport was 390×844. Images are full-page captures with variable heights.
- Read `browser-demo.json` and `browser-unavailable.json`. These report 18 and 12 browser checks respectively, including no horizontal page overflow. Those checks do not establish visual fidelity or absence of internal layout defects.
- Compared actual supplied reference pixels from the CN-02/03/11/12/13 ZIP packages. Eight reference previews were inspected, listed below.
- This review does not certify later edits, physical devices, other browsers, accessibility compliance, animation, or live AI quality. CN-03 evidence is the terminal cancellation state, not a complete visual review of every generation stage. No pixel-perfect claim is made.

## Baseline findings: `9094403`

Severity: P2 = visible usability/state-communication defect to fix before polished acceptance; P3 = polish/readability concern. No screenshot-only P0/P1 blocker was established.

At the first-review handoff, the implementation owner reported source fixes for the CN-11 identity/header layout, CN-03 cancellation copy, and CN-02 adjacent availability status/non-sticky creation controls. The targeted recheck above now documents the observed `0d235b2` improvements. Findings below are retained historical observations of `9094403`, not unresolved claims against the latest reviewed images.

### P2: CN-11 mobile profile identity collapses into a narrow column

Evidence: `CN-11-mobile-demo.png`, `CN-11-mobile-unavailable.png`; desktop counterparts do not show the same collapse.

The avatar, profile text and wide “Account information” button remain on one row. The account email wraps into roughly six very short fragments, including “browse”, “r-”, “@exam” and “ple.test”. The supporting sentence also becomes a tall narrow column. This inflates the profile block and pushes the principal banner far down. The original reference has a compact, readable identity block, but its short sample name does not test a real email.

Recommended fix: place the account action below the identity at narrow widths, preserve usable text width, and test long email/display names at 320/375/390px. Do not solve this by showing fictional profile information.

### P2: CN-03 cancelled state retains active-generation promises

Evidence: both `CN-03-cancelled-*-demo.png` files.

“Task cancelled” and “Let’s leave this one a mystery” correctly indicate a terminal state, yet the same screen still says “Don’t blink. The story is about to turn” and “The reveal is still ahead”. A partly filled creation-progress strip remains. The contradictory text can make a cancelled job look as though a result is still coming.

Recommended fix: use terminal-state-specific supporting copy and presentation, clearly state that no result was created, and retain the restart action. The original active-generation reference is not an appropriate copy source for cancellation.

### P2: unavailable creation status is visually remote from the creation action

Evidence: `CN-02-desktop-unavailable.png`, `CN-02-mobile-unavailable.png`.

The prominent gradient “Let it happen” action looks available, while “Generation is not configured yet” appears near the bottom of a long white panel, below the initial viewport. The supplied browser report says generation is refused without producing a version, so this is not evidence of fabricated success. It is an information-hierarchy defect: the service limitation should be visible before someone prepares an input or presses the action.

Recommended fix: place the unavailable notice next to the action or input heading; give the action an explicitly unavailable or supported alternative state without losing access to samples/uploads.

### P3: some important supporting text is too visually faint/small

Evidence: CN-02 desktop/mobile upload constraints, camera fallback and sample disclaimers; CN-11 light-panel descriptive text; small mobile navigation captions.

Main headings and primary controls are readable, but pale lavender/gray supporting text on the near-white surfaces and tiny captions are harder to read at native mobile scale. The reference family is similarly soft, but the runtime adds operational disclaimers that deserve stronger treatment. Increase the size/contrast of essential constraints and status information. This is a qualitative observation, not a measured WCAG failure or compliance audit.

### Verification concern: fixed controls overlay content in full-page captures

Evidence: CN-02 demo/unavailable desktop/mobile, plus the viewport-fixed mobile navigation across the set.

CN-02's fixed gradient action and translucent backing cross the sample-input area; on the mobile demo capture the sample heading is largely obscured. The mobile navigation also appears midway down long screenshots, covering whichever document content lies at the original viewport boundary.

Do not treat every such overlap as an unreachable-control defect: full-page capture preserves fixed elements at their viewport position, and the original CN-11 full-page reference exhibits this effect too. Verify with ordinary viewport screenshots at initial, middle and end scroll positions, plus keyboard focus/scroll-into-view. Ensure the creation bar and bottom navigation have coordinated safe areas and every sample/control can be fully exposed. Static evidence alone does not establish that this is blocked in normal scrolling.

## Strengths and fidelity boundaries

- The dark navy/lavender palette, gradient primary actions, orb motif, rounded panels, supplied input examples and CN-11 collage preserve a recognizable relationship to the originals. The global web shell, proportions, typography and desktop composition differ; this is an adaptation, not a pixel-identical reproduction.
- CN-04/05/07/08/09/10 demo cards visibly identify text concepts and do not present the supplied example photographs as newly generated output.
- CN-08 unavailable is a clear empty library. CN-11 unavailable uses zero counters and a real empty recent-work panel rather than filling the account with mock creations. The decorative collage is labelled as examples on desktop; keep that distinction legible on narrow screens too.
- CN-06/07 distinguish a local development preview from public publication and explain safety hold/source privacy. Visual evidence alone does not prove the permission enforcement.
- CN-12 explicitly says the version has no image, video generation is not connected, motion choices are planning-only, and its playable demo is pre-made design material. This is more honest than reusing the original's ready-to-generate imagery/copy.
- CN-13 retains a strong credit hierarchy while adding “Not yet available”, service-disabled context and explicit future-membership/no-payment wording. Its aspirational headline is more prominent than the limitation, but the limitation is present.
- Across the inspected widths, major panels remain within the page width; no screenshot shows horizontal page clipping. This agrees with the browser report but does not cover untested widths or content lengths.

## Runtime PNGs inspected

Every entry below was opened and visually inspected. Brace notation expands to both exact filenames.

- `CN-01-{desktop,mobile}-demo.png`
- `CN-02-{desktop,mobile}-demo.png`
- `CN-03-cancelled-{desktop,mobile}-demo.png`
- `CN-04-{desktop,mobile}-demo.png`
- `CN-05-{desktop,mobile}-demo.png`
- `CN-06-{desktop,mobile}-demo.png`
- `CN-07-{desktop,mobile}-demo.png`
- `CN-08-{desktop,mobile}-demo.png`
- `CN-09-{desktop,mobile}-demo.png`
- `CN-10-{desktop,mobile}-demo.png`
- `CN-11-{desktop,mobile}-demo.png`
- `CN-12-{desktop,mobile}-demo.png`
- `CN-13-{desktop,mobile}-demo.png`
- `CN-01-{desktop,mobile}-unavailable.png`
- `CN-02-{desktop,mobile}-unavailable.png`
- `CN-08-{desktop,mobile}-unavailable.png`
- `CN-11-{desktop,mobile}-unavailable.png`
- `CN-13-{desktop,mobile}-unavailable.png`

## Original reference PNGs inspected

Source packages: `design/extracted/Eupra发生_MVP1.0/Eupra_V0.2_CN-{02,03,11,12,13}.zip`.

- `CN-02_mobile_en-US.png`, `CN-02_desktop_showcase.png`
- `CN-03_mobile_en-US.png`, `CN-03_desktop_showcase.png`
- `CN-11_mobile_en-US.png`, `CN-11_full_en-US.png`
- `CN-12_mobile_en-US.png`
- `CN-13_mobile_en-US.png`

## Further recheck required

The targeted recheck above covers the stated `0d235b2` images. Recheck any subsequent changed wording/layout against its own exact-head evidence; add 320/375px long-identity and additional scroll-position checks. Existing CI success does not verify later changes or untested viewports.

## Final wording follow-up

After the review above, `b611fcaace859484cc57977d795c4d0c78eedf16` passed run 39908730333. Direct inspection of its Chinese mobile CN-06 capture confirms the notice now says production review/publishing is not connected and no moderation task is running, while local-preview consent remains legible and separate. This narrow wording/pixel check does not remove the remaining polish issues above.
