# Eupra design inventory and delivery gates

Audit date: 2026-10-23. Package root: `design/extracted/Eupra发生_MVP1.0/`.

## Audit method and provenance

Read all five top-level Markdown documents and all 20 page specification documents. Inventoried the extracted filesystem and inspected actual supplied PNG pixels for CN-02 Chinese mobile, CN-04 Chinese mobile and WEB-01 Chinese desktop first screen. No supplied build scripts or prototype JavaScript were executed by this audit. Image inspection confirms visual intent, not implementation equivalence or current browser correctness.

The package contains 20 nested ZIP archives and 20 extracted page directories, plus three standalone logo PNGs. At audit time: 493 files including retained ZIPs; 119 PNG, 77 WebP, 20 SVG, 6 JPG, 6 MP4, 83 JSON, 46 Markdown, 44 JavaScript, 40 HTML, 17 CSS, 15 Python and 20 ZIP files. Counts include duplicates and preview/reference images; they are not counts of unique production assets.

## Source authority

1. `Eupra_MVP1.0_研发交接总包_20261020.md`: highest-priority engineering baseline, final 20-page map, market gates, canonical Version/StoryWorld/GenerationJob, API, video ledger and release acceptance.
2. Latest page package `spec/*.md`, tokens and editable HTML/CSS: authoritative page visual and interaction detail where consistent with handoff.
3. `Eupra_荒诞反转引擎_V2.0_核心体验与研发规格_20261020.md`: latest specialized engine baseline, expressly extends handoff and V1. Use its updated seeds/Taste/Story Memory, while retaining canonical handoff API/domain names.
4. `Eupra_引擎_2026.md`: actual V1 engine document (internal date 2026-10-14). Despite the different filename, this is the V1 document referenced by handoff. Its detailed safety contracts remain useful; obsolete image quotas do not.
5. `Eupra_MVP1_0_Product_Blueprint_20261014.md`: historical product rationale; superseded community/quotas/prices/splits do not override final handoff.
6. `Eupra_V0.2_高保真逐页设计规划_20261014.md`: historical visual planning; 18-page map and original CN-10 video assignment are obsolete.

### Conflicts resolved explicitly

- There are 20 delivered consumer page packages, not 18. CN-10 is creator/world, CN-12 video and CN-13 credits; GL identifiers in old material are functional aliases, not additional screens.
- Text/image/mixed/image-remix are free without a visible image balance for normal users. Server abuse limits still apply. Only successful five-second videos consume the daily two-video allowance.
- CN has no public feed, comments, follows, tipping or settlement. Server flags enforce this, not merely hidden navigation. GLOBAL may enable those surfaces with permissions.
- V2's 18–24 text seeds and staged Taste Judge replace old three-candidate guidance. A single selected image is the default; no expensive image batch picker on the primary path.
- Per-page upload limits differ (CN-02 15 MB, WEB-01 10 MB). Use one server-configured limit and render it consistently rather than treating both as immutable.
- Earlier per-page APIs and names such as post/creation are illustrative; canonical handoff uses Version, generation-jobs and share-links.
- CN-05's optional branch proposals are secondary exploration, not a required multi-image first-result selection flow.
- The handoff describes the package as frozen/accepted, while several page specs say pending founder acceptance. Treat visuals as the implementation baseline without inventing approval evidence.

## Final page/package inventory

All paths below are relative to the package root. Every page has a Markdown specification and zh-CN/en-US JSON resources. Counts refer only to that extracted page directory.

| ID | Page | Market | Extracted package | Files | Asset-folder entries |
| --- | --- | --- | --- | ---: | ---: |
| CN-01 | 品牌启动 / 欢迎 | CN / GLOBAL | `Eupra_V0.2_CN-01` | 18 | 2 |
| CN-02 | 创作首页 | CN / GLOBAL | `Eupra_V0.2_CN-02` | 25 | 5 |
| CN-03 | 正在发生 | CN / GLOBAL | `Eupra_V0.2_CN-03` | 22 | 4 |
| CN-04 | 生成结果 | CN / GLOBAL | `Eupra_V0.2_CN-04` | 23 | 4 |
| CN-05 | 再离谱点 | CN / GLOBAL | `Eupra_V0.2_CN-05_再离谱点_高保真设计与源码完整交付包` | 9 | 0 |
| CN-06 | 分享与导出 | CN / GLOBAL | `Eupra_V0.2_CN-06_分享与导出_高保真设计与源码完整交付包` | 8 | 0 |
| CN-07 | 分享落地 H5 | CN / GLOBAL | `Eupra_V0.2_CN-07_分享落地H5_高保真设计与源码完整交付包` | 9 | 0 |
| CN-08 | 我的作品 | CN / GLOBAL | `Eupra_V0.2_CN-08` | 27 | 8 |
| CN-09 | 作品详情 | CN / GLOBAL | `Eupra_V0.2_CN-09_作品详情_高保真设计与源码完整交付包` | 21 | 5 |
| CN-10 | 创作者主页 × 故事世界 | CN restricted / GLOBAL | `Eupra_V0.2_CN-10` | 27 | 8 |
| CN-11 | 我的 / 设置 | CN / GLOBAL | `Eupra_V0.2_CN-11` | 25 | 8 |
| CN-12 | 5 秒视频生成 | CN / GLOBAL | `Eupra_V0.2_CN-12` | 21 | 6 |
| CN-13 | 发生余额 / 会员权益 | CN / GLOBAL | `Eupra_V0.2_CN-13` | 23 | 5 |
| CN-14 | 全球发现流 | GLOBAL only | `Eupra_V0.2_CN-14` | 30 | 8 |
| CN-15 | 公开作品详情与互动 | GLOBAL only | `Eupra_V0.2_CN-15` | 24 | 5 |
| CN-16 | 评论一键二创 | GLOBAL only | `Eupra_V0.2_CN-16_` | 26 | 8 |
| CN-17 | 平行版本广场 | GLOBAL only | `Eupra_V0.2_CN-17` | 34 | 8 |
| CN-18 | 互动通知与创作接力 | GLOBAL only | `Eupra_V0.2_CN-18` | 26 | 7 |
| CN-19 | 创作者经济与收益中心 | GLOBAL only | `Eupra_V0.2_CN-19` | 28 | 7 |
| WEB-01 | 官网与即时创作入口 | CN / GLOBAL | `Eupra_V0.2_WEB-01` | 39 | 11 |

## Visual implementation baseline

- CN-02 actual pixels: soft lavender-white canvas, dark headline, purple emphasis, rounded white creator panel, three input modes, empty illustrated upload well, three official example tiles, fixed blue-purple-pink pill CTA. It is not a generic dark dashboard.
- CN-04 actual pixels: near-black/navy, image-dominant crowned orange cat in sunglasses, rounded cinematic hero, visible AI badge, large overlaid Chinese title, subordinate caption, strong gradient “再离谱点”, three secondary save/share/video controls.
- WEB-01 actual pixels: separate responsive marketing/creation surface, spacious dark desktop hero, left headline and light workbench, right layered cat/moon cards against a luminous portal. Do not replace it with an enlarged mobile welcome screen.
- Core colors: near-black `#080B18`, cards near `#11182B`, light panel near `#F8F8FC`, restrained ice-blue/electric-purple/soft-pink accents. Unify page variants into shared tokens; 24–30 px large-card radii.
- Typical mobile reference 390×844; verify 375/390/430 widths, shorter devices and actual safe areas. Desktop phone frames and simulated 9:41 status bars are prototype presentation, not required production chrome.
- CN-03 has a dark suspense stage inside a light creation environment; CN-08 is dark in the latest delivered package despite the old plan calling management light. CN-11 mixes a dark hero and light settings panels.
- Match supplied imagery and composition, not screenshots as entire page backgrounds. Maintain semantic interactive components, contrast, keyboard use, focus, reduced motion and long-English wrapping.

## Asset handling

Reuse independent local assets: orb logo, portal SVG/JPG, cat source/CEO/moon, shiba agent, space runner, golden girl and office scene. Preview PNGs are review evidence, not substitutes for components or licensed production output. Repeated filenames across packages require hash/visual comparison before deduplication.

CN-05/CN-06/CN-07 contain no standalone assets folder: their HTML is self-contained, with embedded presentation assets. Do not claim missing imagery solely because there is no assets directory. CN-13 `assets/SOURCES.md` is provenance text, not media. The six MP4s across CN-12/CN-13/WEB-01 are demo five-second motion posters/localized variants, not proof of an integrated video provider.

The three top-level `logo/logo.png`, `logo/logo1.png`, `logo/logo2.png` are additional brand candidates. Inspect before replacing the page baseline orb. Asset availability is not an independent commercial-rights clearance.

### Exact per-package source and asset index

#### Eupra_V0.2_CN-01
- `Eupra_CN01_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN01_V0.2_Delivery/assets/portal-world.svg`
- `Eupra_CN01_V0.2_Delivery/index.html`
- `Eupra_CN01_V0.2_Delivery/spec/CN-01_设计与开发标注.md`
- `Eupra_CN01_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-02
- `Eupra_CN02_V0.2_Delivery/assets/example-cat.jpg`
- `Eupra_CN02_V0.2_Delivery/assets/example-run.svg`
- `Eupra_CN02_V0.2_Delivery/assets/example-space.jpg`
- `Eupra_CN02_V0.2_Delivery/assets/example-world.svg`
- `Eupra_CN02_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN02_V0.2_Delivery/index.html`
- `Eupra_CN02_V0.2_Delivery/spec/CN-02_设计与开发标注.md`
- `Eupra_CN02_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-03
- `Eupra_CN03_V0.2_Delivery/assets/example-cat.jpg`
- `Eupra_CN03_V0.2_Delivery/assets/example-cat.webp`
- `Eupra_CN03_V0.2_Delivery/assets/example-run.svg`
- `Eupra_CN03_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN03_V0.2_Delivery/index.html`
- `Eupra_CN03_V0.2_Delivery/spec/CN-03_设计与开发标注.md`
- `Eupra_CN03_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-04
- `Eupra_CN04_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN04_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN04_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN04_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN04_V0.2_Delivery/index.html`
- `Eupra_CN04_V0.2_Delivery/spec/CN-04_设计与开发标注.md`
- `Eupra_CN04_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-05_再离谱点_高保真设计与源码完整交付包
- `Eupra_CN05_V0.2_Delivery/index.html`
- `Eupra_CN05_V0.2_Delivery/spec/CN-05_设计与开发标注.md`

#### Eupra_V0.2_CN-06_分享与导出_高保真设计与源码完整交付包
- `Eupra_CN06_V0.2_Delivery/index.html`
- `Eupra_CN06_V0.2_Delivery/spec/CN-06_设计与开发标注.md`

#### Eupra_V0.2_CN-07_分享落地H5_高保真设计与源码完整交付包
- `Eupra_CN07_V0.2_Delivery/index.html`
- `Eupra_CN07_V0.2_Delivery/spec/CN-07_设计与开发标注.md`

#### Eupra_V0.2_CN-08
- `Eupra_CN08_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN08_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN08_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN08_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN08_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN08_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN08_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN08_V0.2_Delivery/assets/work-day.webp`
- `Eupra_CN08_V0.2_Delivery/index.html`
- `Eupra_CN08_V0.2_Delivery/spec/CN-08_设计与开发标注.md`
- `Eupra_CN08_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-09_作品详情_高保真设计与源码完整交付包
- `Eupra_CN09_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN09_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN09_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN09_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN09_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN09_V0.2_Delivery/index.html`
- `Eupra_CN09_V0.2_Delivery/spec/CN-09_设计与开发标注.md`
- `Eupra_CN09_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-10
- `Eupra_CN10_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN10_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN10_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN10_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN10_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN10_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN10_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN10_V0.2_Delivery/assets/work-day.webp`
- `Eupra_CN10_V0.2_Delivery/index.html`
- `Eupra_CN10_V0.2_Delivery/spec/CN-10_设计与开发标注.md`
- `Eupra_CN10_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-11
- `CN-11/assets/cat-ceo-hero.webp`
- `CN-11/assets/cat-moon-hero.webp`
- `CN-11/assets/demo-source.webp`
- `CN-11/assets/golden-girl.webp`
- `CN-11/assets/orb-mark.svg`
- `CN-11/assets/shiba-agent.webp`
- `CN-11/assets/space-runner.webp`
- `CN-11/assets/work-day.webp`
- `CN-11/index.html`
- `CN-11/spec/CN-11_设计与开发标注.md`
- `CN-11/tokens.json`

#### Eupra_V0.2_CN-12
- `CN-12/assets/cat-ceo-hero.webp`
- `CN-12/assets/cat-moon-hero.webp`
- `CN-12/assets/cn12_cinematic_demo_5s.mp4`
- `CN-12/assets/cn12_cinematic_demo_5s_en.mp4`
- `CN-12/assets/demo-source.webp`
- `CN-12/assets/orb-mark.svg`
- `CN-12/index.html`
- `CN-12/spec/CN-12_设计与开发标注.md`
- `CN-12/tokens.json`

#### Eupra_V0.2_CN-13
- `Eupra_CN13_V0.2_Delivery/assets/SOURCES.md`
- `Eupra_CN13_V0.2_Delivery/assets/cat-ceo.webp`
- `Eupra_CN13_V0.2_Delivery/assets/cat-moon.jpg`
- `Eupra_CN13_V0.2_Delivery/assets/demo-5s-en.mp4`
- `Eupra_CN13_V0.2_Delivery/assets/demo-5s.mp4`
- `Eupra_CN13_V0.2_Delivery/index.html`
- `Eupra_CN13_V0.2_Delivery/spec/CN-13_设计与开发标注.md`

#### Eupra_V0.2_CN-14
- `Eupra_CN14_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN14_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN14_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN14_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN14_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN14_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN14_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN14_V0.2_Delivery/assets/work-day.webp`
- `Eupra_CN14_V0.2_Delivery/index.html`
- `Eupra_CN14_V0.2_Delivery/spec/CN-14_高保真设计与开发标注.md`
- `Eupra_CN14_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-15
- `Eupra_CN15_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN15_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN15_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN15_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN15_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN15_V0.2_Delivery/index.html`
- `Eupra_CN15_V0.2_Delivery/spec/CN-15_高保真设计与开发标注.md`
- `Eupra_CN15_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-16_
- `Eupra_CN16_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN16_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN16_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN16_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN16_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN16_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN16_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN16_V0.2_Delivery/assets/work-day.webp`
- `Eupra_CN16_V0.2_Delivery/index.html`
- `Eupra_CN16_V0.2_Delivery/spec/CN-16_设计与开发标注.md`

#### Eupra_V0.2_CN-17
- `Eupra_CN17_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN17_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN17_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN17_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN17_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN17_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN17_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN17_V0.2_Delivery/assets/work-day.webp`
- `Eupra_CN17_V0.2_Delivery/index.html`
- `Eupra_CN17_V0.2_Delivery/spec/CN-17_设计与开发标注.md`
- `Eupra_CN17_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-18
- `Eupra_CN18_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN18_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN18_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN18_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN18_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN18_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN18_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN18_V0.2_Delivery/index.html`
- `Eupra_CN18_V0.2_Delivery/spec/CN-18_设计与开发标注.md`
- `Eupra_CN18_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_CN-19
- `Eupra_CN19_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_CN19_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_CN19_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_CN19_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_CN19_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_CN19_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_CN19_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_CN19_V0.2_Delivery/index.html`
- `Eupra_CN19_V0.2_Delivery/spec/CN-19_高保真设计与开发标注.md`
- `Eupra_CN19_V0.2_Delivery/tokens.json`

#### Eupra_V0.2_WEB-01
- `Eupra_WEB01_V0.2_Delivery/assets/cat-ceo-hero.webp`
- `Eupra_WEB01_V0.2_Delivery/assets/cat-moon-hero.webp`
- `Eupra_WEB01_V0.2_Delivery/assets/demo-source.webp`
- `Eupra_WEB01_V0.2_Delivery/assets/golden-girl.webp`
- `Eupra_WEB01_V0.2_Delivery/assets/orb-mark.svg`
- `Eupra_WEB01_V0.2_Delivery/assets/portal-gateway.jpg`
- `Eupra_WEB01_V0.2_Delivery/assets/shiba-agent.webp`
- `Eupra_WEB01_V0.2_Delivery/assets/space-runner.webp`
- `Eupra_WEB01_V0.2_Delivery/assets/video-demo-en.mp4`
- `Eupra_WEB01_V0.2_Delivery/assets/video-demo-zh.mp4`
- `Eupra_WEB01_V0.2_Delivery/assets/work-day.webp`
- `Eupra_WEB01_V0.2_Delivery/index.html`
- `Eupra_WEB01_V0.2_Delivery/spec/WEB-01_设计与开发标注.md`

## Frozen requirements vs intentionally undecided choices

Frozen: one low-friction image/text/mixed creation input; new image + short title + one/two sentences; exact parent/root/comment attribution; immutable version nodes; branch continuation; private source assets; real asynchronous phases; safety before/after generation and at export; one unified locale resource system; no lost draft on locale switch; CN feature isolation; two successful five-second videos/day; failure/cancellation release and request/callback idempotency.

Undecided, so expose configuration/adapters rather than invented commitments: final text/image/video/safety suppliers, Plus prices, extra video credits, audio at launch, overseas payment/split suppliers, revenue percentages, withdrawal date, native app stack, future China community release. The handoff recommends PostgreSQL, queue/Redis and object storage; a local scaffold or SQLite development mode must not be described as completed production infrastructure. User-requested Rust can implement the backend while preserving the domain/API contracts.

## Honest implementation scope

This audit does not certify the new backend/frontend. The deliverable is an implementation foundation until live services and end-to-end acceptance are separately evidenced. Separate three labels everywhere: implemented local functionality; explicitly simulated demo; unavailable production integration. Never label stock images as personalized generated results, a local URL as an externally accessible share link, a motion poster as new AI video, keyword filtering as multimodal moderation, or static balances as real entitlements.

Design-package QA is historical and heterogeneous. CN-08 says its PNG is a design review rendering rather than browser output. CN-12 and CN-15 explicitly lack completed real-browser regression. Other packages include browser-check JSON and screenshots, which still need new integrated-app regression. No package QA record automatically passes the rebuilt product.

First implementation priority: WEB-01/CN-02 → CN-03 → CN-04 → CN-05 → CN-06 → CN-07, plus persisted CN-08/CN-09 and settings. Then real video/ledger and CN-10 restricted world. GLOBAL community and economy are later gates, not substitutes for generation quality. Providing all 20 routes alone is not MVP completion.

## P0 acceptance checklist (unverified until evidence attached)

- [ ] Root image, text and mixed creation reach a genuinely new reviewed image + coherent title/caption without requiring a prompt tutorial.
- [ ] First twist and continuation preserve recognizable source anchors; three consecutive remixes evolve concrete consequences, not the same template.
- [ ] A child points to the exact selected historic parent; its root is stable; sibling branches do not overwrite each other.
- [ ] Comment remix retains both inspiration author and current creator; no automatic publication merely because a comment was sent.
- [ ] Jobs survive refresh, show real stages, support truthful failure/hold/cancellation and bounded retry; no fake countdown.
- [ ] Duplicate requests create one job/version/effect; repeated callbacks do not duplicate ledger entries.
- [ ] Successful works persist in personal library; public lineage never reveals private input media/EXIF/review evidence.
- [ ] Share token resolves for a separate visitor with allowed visibility; blocked/revoked/expired content cannot be read or remixed.
- [ ] Owner revocation of remix permission is checked server-side, including new requests against old links.
- [ ] CN rejects community operations server-side and hides CN-14..19/public CN-10 controls; locale does not bypass market gating.
- [ ] Two successful video files consume exactly two daily credits; third is blocked; failed/rejected/cancelled jobs release reservation; images remain available.
- [ ] Quota concurrency, midnight/reset timezone and service restart are tested against a persistent ledger.
- [ ] Input, concept, generated image/video, combined caption/image, comments and export are reviewed; safety outage holds rather than publicly approves.
- [ ] Exported images/videos have appropriate visible and file metadata labels; no remove-label action; actual artifact inspected.
- [ ] Real user/session authentication and authorization protect personal works/settings/uploads; guest capabilities are bounded.
- [ ] Chinese/English UI keys align, overlays/toasts switch too, user input/upload/selected version/job stay intact.
- [ ] Responsive browser regression at 375/390/430 and desktop, keyboard/focus/reduced-motion/long text, no horizontal overflow.
- [ ] Source-matched visual screenshots demonstrate the cinematic result and light creation baseline, rather than a generic form/dashboard.
- [ ] Trace ties job → safety → concept → engine/provider/model/version/cost → output → share/remix behavior.
- [ ] Golden/challenge and human pairwise evaluation support quality claims; fixture views are excluded from success metrics.
- [ ] Required moderation operations and launch-region/privacy/rights checks are complete before public production release.

See `ENGINE-CONTRACT.md` for V2 pipeline, safety, state and ledger detail. These boxes are release gates, not a claim that the prototype or current build has passed them.
