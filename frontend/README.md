# Eupra unified frontend

React + TypeScript + Vite, a shared design system, and one paired zh-CN/en-US dictionary. All implementation is new application code; original standalone prototype pages are reference material only.

## Run

Start the Rust backend on 127.0.0.1:8787, then:

    npm ci --cache /tmp/eupra-npm-cache
    npm run dev

Vite listens on port 5173 and proxies /api. `npm run build` type-checks and builds static assets. A production web server must serve index.html for client-side routes and forward /api to the backend on the same origin.

## Routes

- `/`: WEB-01 responsive landing and inline creation
- `/welcome`: distinct CN-01 welcome, original supplied portal artwork and creation-mode shortcuts
- `/create`: CN-02 image/text/mixed creation
- `/jobs/:id`: CN-03 real server job states
- `/result/:id`: CN-04 result
- `/remix/:id`: CN-05 continuation
- `/share/:id`: CN-06 sharing, safety hold enforced by API
- `/s/:token`: CN-07 permission-filtered share landing
- `/works`: CN-08 personal library
- `/versions/:id`: CN-09 immutable version detail
- `/worlds/:id`: CN-10 private story world and parent links
- `/settings`: CN-11 account/language settings
- `/video/:id`: CN-12 honest unavailable video state
- `/balance`: CN-13 server video-credit balance
- `/examples/ceo`, `/examples/moon`: clearly labeled static design examples
- Other routes: honest unavailable state; CN public-community navigation is absent.

## Boundaries

Default missing-provider configuration never uploads an image merely to fail generation. Explicit server demo configuration returns persistent text concepts; no generated image is invented. Supplied cat artworks appear only on labeled example and marketing surfaces. Result pages use actual returned image_url only. Sharing and export do not fake success when the backend safety gate returns HOLD. Video/payment features have no fake working or payment buttons. Public social/creator-economy functionality is not implemented in this CN-first increment. A separately enabled loopback-only local text preview supports owner review, expiring capability links, revocation, and authenticated continuation. This never changes production HOLD or exports user-generated media.

Language changes preserve in-memory file preview, draft, route and job context. Text draft survives navigation/reload in sessionStorage; upload File objects intentionally do not persist across a browser reload. Authentication uses HttpOnly backend cookie sessions and a modal with Escape dismissal, focus trapping and restoration. Password reset/email verification are not yet provided by the backend.

## Verification

`npm test` runs 29 retained Vitest + jsdom component tests: locale/draft/file retention, auth dismissal and back-navigation behavior, fail-closed unconfigured generation, real API-response result routing with explicit demo labeling, mobile-navigation DOM, and immutable root/parent display. API calls are mocked in these component tests; backend and end-to-end tests are separate.

Production TypeScript/Vite build passes. Actual Chromium visual/mobile layout verification was blocked by the execution environment (browser local-socket restriction and failed reviewed browser launcher). Component tests are not a substitute for rendered-browser visual QA. The supplied reference PNGs were visually inspected before implementation, but final-page screenshot comparison remains required before release.

## Personal-core continuation

- CN-01 now has its own welcome composition rather than reusing the marketing homepage. The supplied original portal-world.svg is reused unchanged. The latest supplied logo.png is the main brand mark; logo1.png and logo2.png are retained original wordmarks.
- CN-05 is now a visual version explorer with actual history cards and selected-parent continuation, not just a text form. No candidate outcomes are invented.
- CN-08 now provides truthful counts, a featured story world, search, original/remix/favorite filters, chronological sorting, and persisted favorite toggles.
- CN-09 includes a visual ancestor path built from actual parent IDs, with selectable historical versions.
- CN-10 includes creator/world tabs, visual selected version, history-card selection and the accurate parent tree. Creator counts are explicitly scoped to the currently loaded world.
- CN-06 renders the returned image if present; production HOLD remains intact. Explicit server opt-in enables a local-only review and expiring text-preview link.
- CN-07 waits for the shared DTO, handles errors, and preserves both source version and capability token when an authenticated visitor continues the story.
- Only bundled design examples support poster PNG download, with large explicit AI/design-example labeling. User output export remains disabled under HOLD. The exporter is isolated in src/poster.ts.

29 jsdom tests cover these core interactions and previous authentication/draft behavior. Browser screenshot/layout QA remains blocked, not passed.

## Shared components and original assets

VersionExplorer.tsx supplies the common image/text-concept stage and selectable version cards used by remix, details, story worlds and preview landing. PersonalPanels.tsx supplies CN-11 light account/settings and the distinct CN-12/CN-13 video/credit panels. Its optional original MP4 playback/download is prominently labeled as a supplied design demonstration, never a generated result. Native user content remains separate.

The current supplied logo.png is used unchanged in navigation and the welcome screen. Original wordmark variants are retained. All artwork comes from the supplied delivery packages; there are no replacement generated assets.

Safety HOLD is not a content lifecycle state. The library does not infer a draft status or expose an unsupported draft filter from safety review. Non-demo image-less provider results are labeled text concepts, not demos.

CreationPanels.tsx now owns the full CN-02 workbench: original cat/run/world input samples, camera/file fallback, configured MIME/size validation, image/text/mixed drafts, and client-side SVG-to-PNG sample conversion. JobTheater renders server-derived stage segments and authorized input_summary only; it never borrows an unrelated current draft for a restored task. All documented complete/staged-engine phase descriptions are localized without fake percentages or countdowns.

The CI browser harness at ../qa/browser_smoke.py has been expanded to capture the implemented personal-core pages at 1440/390, test local review/favorite/filter flows, download and validate an actual labeled example PNG, and select all original samples plus camera fallback. It is syntax-checked but remains unexecuted locally due the documented browser restriction.
