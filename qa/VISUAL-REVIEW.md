# Runtime visual review: first successful CI

Reviewed 2026-10-23 UTC. This is an actual pixel review of downloaded runtime screenshots, not a filename or source-code-only inspection. No application source was edited and no browser was launched for this review.

## Evidence and scope

- Tested head: `9094403202945e6fb1d1ee577efda46f023640dd`.
- CI: https://github.com/sanyexieai/Eupra/actions/runs/39906250531
- Artifact: https://github.com/sanyexieai/Eupra/actions/runs/39906250531/artifacts/12480398320
- Runtime evidence directory: `eupra-product-deliverables/ci-9094403` (sibling of the project directory).
- Inspected all 36 CN runtime PNGs listed below: 26 demo-mode images and 10 unavailable-mode images. Desktop viewport was 1440×1000; mobile viewport was 390×844. Images are full-page captures with variable heights.
- Read `browser-demo.json` and `browser-unavailable.json`. These report 18 and 12 browser checks respectively, including no horizontal page overflow. Those checks do not establish visual fidelity or absence of internal layout defects.
- Compared actual supplied reference pixels from the CN-02/03/11/12/13 ZIP packages. Eight reference previews were inspected, listed below.
- This review does not certify later edits, physical devices, other browsers, accessibility compliance, animation, or live AI quality. CN-03 evidence is the terminal cancellation state, not a complete visual review of every generation stage. No pixel-perfect claim is made.

## Findings

Severity: P2 = visible usability/state-communication defect to fix before polished acceptance; P3 = polish/readability concern. No screenshot-only P0/P1 blocker was established.

Implementation status at handoff: the implementation owner reports source fixes for the CN-11 identity/header layout, CN-03 cancellation copy, and CN-02 adjacent availability status/non-sticky creation controls. Those changes await the next CI screenshots. All findings below describe the observed `9094403` baseline pixels, not the unverified current source.

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

## Recheck required

After relevant fixes, capture the exact new head, re-inspect CN-02/03/11 on desktop and 390px, and add 320/375px long-identity and scroll-position checks. Existing CI success is a baseline, not verification of those later changes.
