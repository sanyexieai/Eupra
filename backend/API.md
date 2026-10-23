# Eupra local API v1
Base `/api/v1`. JSON requests/responses. Cookie session `eupra_session`, HttpOnly SameSite=Lax. Fetch with credentials; development frontend proxies `/api` to `127.0.0.1:8787`. Application errors `{error:{code,message}}`. Malformed JSON/multipart/body-limit extractor errors can be plain text with 4xx; clients must tolerate non-JSON errors.

- GET `/config` → `{market:"CN",locale:"zh-CN",provider:"unavailable"|"demo"|"http",generation_enabled:bool,demo:bool,features:{community:false,video:false,payments:false},upload:{max_bytes:10485760,mime_types:["image/jpeg","image/png","image/webp"]},video:{daily_limit:2,successful_today:0},policy_version:"20261020"}`. Default unavailable. Demo outputs visibly marked, not AI images; sharing blocked pending safety integration.
- POST `/auth/register` or `/auth/login` `{email,password}` → `{user:{id,email}}` + cookie. Password minimum 10 UTF-8 bytes, maximum 256.
- POST `/auth/logout` → `{ok:true}`; GET `/auth/me` → `{user:{id,email}}` or 401.
- POST `/uploads` multipart field `file` → `{id,mime_type,size,url}`. Private authenticated image; metadata stripped by decode/re-encode. GET `/uploads/{id}` serves only owner. Text needs no upload.
- POST `/generation-jobs` header `Idempotency-Key` required; body `{kind:"first_twist"|"continuation"|"video",text?:string,source_id?:string,parent_version_id?:string,locale?:"zh-CN"|"en"}` → job. Missing provider gives 503 `PROVIDER_UNAVAILABLE`; video gives 503 `VIDEO_UNAVAILABLE`. Continuation requires owned parent (or permission-bearing share_token when sharing becomes available). Job `{id,status:"queued"|"running"|"succeeded"|"failed"|"cancelled",stage (uppercase authoritative stage),version_id:null|string,error:null|{code,message},demo,created_at}`.
- GET `/generation-jobs/{id}` → job. POST `/generation-jobs/{id}/cancel` → job. Owner only.
- GET `/versions/{id}` → version `{id,root_version_id,parent_version_id,story_world_id,creator_id,title,caption,image_url,source_id,kind,depth,remix_allowed,safety_state:"HOLD",demo,created_at,story_memory:{...}}`; owner only until reviewed share enabled. Demo image_url null (frontend presents labeled illustrative design, never claims image generation).
- GET `/versions/{id}/children` → `{items:[version]}`; GET `/story-worlds/{id}` → `{id,items:[version]}` (owner only).
- POST `/versions/{id}/save` → `{ok:true,version_id}`; PATCH `/versions/{id}/remix-permission` `{remix_allowed:bool}` → version.
- GET `/me/works` → `{items:[version]}` including active owned completed versions; editable creation drafts use /me/drafts; GET `/me/settings` → `{locale:"zh-CN",market:"CN",default_remix_allowed:true}`; PATCH same with locale/default_remix_allowed → settings.
- POST `/share-links` `{version_id}` → 409 `SAFETY_HOLD` until actual output review integration. GET `/share/{token}` permission-filtered, never source data. POST `/versions/{id}/publish` blocked (`FEATURE_DISABLED` for CN).
- GET `/me/video-credits` → `{daily_limit:2,successful_today:0,remaining:2,enabled:false}`.
- POST `/reports` `{version_id,reason}` → `{id,status:"received"}`; access to reported version required.

SQLite durable local implementation. Single process Tokio task worker; interrupted jobs marked failed on restart, no phantom completion. Not production Postgres/Redis/object storage. No email verification/password-reset or live provider/safety integrations yet. No production-complete claim.

Canonical aliases accepted: action MAKE_IT_HAPPEN/PUSH_FURTHER/VIDEO_5S maps to kind; user_text maps to text; source_version_id maps to parent_version_id; body idempotency_key can replace the Idempotency-Key header. COMMENT_TO_VERSION is not enabled.

With a configured HTTP engine, non-demo successful versions can contain private image_url or null and engine.output_type=image|concept_only. All remain safety_state HOLD for export until independent review is integrated. The UI must not label concept-only responses as generated images.

## Explicit local development preview (never production export)
Only enabled with EUPRA_LOCAL_REVIEW=1 and server bound to a loopback address. config.features.local_review and share_preview indicate this mode. Production safety_state stays HOLD, even when the local preview is approved. No real-model or image output is eligible.
- GET /me/review-queue → {items:[owned unreviewed demo-text versions],development_preview:true}.
- POST /versions/{id}/local-review {approved:true|false} → {id,version_id,approved,development_preview:true,safety_state:"HOLD"}. Only owner can approve their own demo text. Withdrawing also revokes previous links. Independent local review/audit rows are retained.
- GET /versions/{id}/reviews → {items:[{id,approved,created_at,review_type:"owner_local_demo_text",production_safety_approval:false}]} (owner only).
- POST /share-links {version_id,expires_in_seconds?:integer} → {id,token,url:"/share/{token}",expires_at,scope:"demo_text_preview",development_preview:true,label}. Default 3600 seconds, min 60, max 86400. Requires explicit local approval. Only token hash is stored; raw token is returned once.
- GET /me/share-links → {items:[{id,version_id,expires_at,revoked}]} (does not return tokens).
- POST /share-links/{id}/revoke → {ok:true,id} (owner only, idempotent).
- GET /share/{token} → {version:{id,root_version_id,parent_version_id,story_world_id,creator_id,title,caption,image_url:null,demo:true,development_preview:true,created_at,remix_allowed,safety_state:"HOLD"},development_preview:true,label,remix_allowed,requires_auth:true,expires_at}. No source_id, source URL, story memory, email or original upload. Guest read only, no-store/no-referrer.
- Signed-in recipient can POST generation-jobs {kind:"continuation",parent_version_id,share_token}, with normal idempotency key. Valid only in local demo provider mode. Rechecks token/expiry/revocation/parent permission before enqueue and commit. Child belongs to recipient with original root/parent IDs. No source ownership/access transfers. Raw capability token is hashed in persisted request audit.
- GET /versions/{id}/contributions → {root_creator_id,parent_creator_id,current_creator_id,revenue_enabled:false}; version owner only. No payout implied.

## Personal assets
- PATCH /versions/{id}/favorite {favorite:boolean} → complete owned version. New versions and works include favorite:false by default.
- GET /me/story-worlds → {items:[{id,root_version_id,title,version_count,updated_at}]} counting only the current user's owned versions.

## Built frontend serving
Optional EUPRA_WEB_DIST must be an absolute directory containing built index.html. The API serves static assets and SPA routes from it; unknown /api routes still return JSON 404, never index.html. Default is API-only. Built frontend responses set no-store, nosniff and no-referrer.
- Story-world response also includes ancestor_references:[{id,access:"private",content_available:false}] for referenced roots/parents not owned by the viewer. No ancestor title/source/media is disclosed. Revocation hides ancestor preview content but does not erase already-created recipient descendants or their contribution IDs.

Authentication has durable per-normalized-email limits (10 attempts/15 minutes), a local global limit (60/minute), and two bounded CPU workers. Normalized upload decoding also uses bounded blocking workers. Generation caps two active jobs/user and 16 across this local process/database. Production distributed/IP-aware controls remain a release requirement.

## Authoritative job progress / resume
Job responses now include input_summary:{kind,text_excerpt,source_id,source_url,parent_version_id,locale}. The excerpt is limited to 80 entered characters; source URL exists only for the current caller's own uploaded input. No shared-parent private source, share token or source owner's memory is exposed.

Stages actually reached (not elapsed-time estimates):
- Queued: REQUEST_INTAKE.
- Explicit template demo: DEMO_TEMPLATE_PREPARATION → DEMO_DRAFT.
- Complete-engine HTTP mode: PROVIDER_PIPELINE → DRAFT. Its internal stage progress is unknown and must not be invented.
- Optional staged HTTP mode: INPUT_SAFETY → REALITY_PARSER → POSSIBILITY_MINER → SEED_FACTORY → DIVERSITY_FILTER → TASTE_JUDGE → CANDIDATE_EXPANDER → PAIRWISE_TOURNAMENT → VISUAL_DIRECTOR → MEDIA_GENERATION → FINAL_JUDGE → OUTPUT_SAFETY → DRAFT. DRAFT succeeds only after private memory validation and version commit. Successful jobs include stage_trace.
- Terminal interruptions: CANCELLED, FAILED; restarted old queued/running jobs use interrupted with failed status.

Frontend should map stages to localized descriptions and use indeterminate progress, not countdowns or invented percentages. A failed stage creates no output version. Cancellation preserves cancelled status even if a provider returns afterward.

## Private creation drafts
GET /me/drafts?state=active|trash|all returns {items:[draft]}, default active.
POST /me/drafts {title?,text?,source_id?,parent_version_id?,locale?} returns a direct draft DTO. Defaults: empty title/text, null references, zh-CN. Title <=120 characters; text <=2000; sources and parents must be owned, parent must not be trashed. Empty drafts are permitted. Maximum 200 active drafts per user.
Draft DTO: {id,title,text,source_id,source_url,locale,parent_version_id,revision,created_at,updated_at,deleted_at}. Text is full original input; source_url is owner-only private upload. No capability tokens are stored in drafts. Shared-parent drafts are not supported; use the authorized shared continuation flow instead.
GET /drafts/{id} returns an active owned draft, otherwise 404.
PATCH /drafts/{id} accepts changed draft fields plus mandatory expected_revision. Returns updated draft; stale revision ->409 REVISION_CONFLICT; omitted revision ->400 REVISION_REQUIRED. Immutable id/owner/timestamps cannot be supplied.
DELETE /drafts/{id} ->{ok:true,id}, recoverable trash only. POST /drafts/{id}/restore ->full draft. Delete/restore increment revision when state changes. Restoring content does not grant permission to a now-deleted parent; generation still revalidates it.

## Recoverable saved-work trash
GET /me/works?state=active|trash|all defaults active; every returned owned version includes deleted_at:null|epoch_seconds.
DELETE /versions/{id} ->{ok:true,id,deleted_at}. It hides only the owner's asset, preserves all immutable version content, lineage, contributions, descendants and source uploads, and revokes that version's preview links/local approval. Idempotent repeated deletion remains safe.
POST /versions/{id}/restore ->full version with deleted_at:null. Old links remain revoked and local review remains withdrawn. Deleted versions are 404 for normal detail/save/favorite/review/remix/export operations. Children already created remain owned by their creators and available independently. Pending generation rechecks parent deletion before committing any child.
No purge/permanent-delete endpoint exists.
GET /versions/{id}/export-permission ->{allowed:false,reason:"REVIEW_NOT_CONFIGURED",safety_state:"HOLD",scope:"none"}. Owner active work only; deleted/unknown/non-owner404. This is an unavailable independent review integration, not a promise that review is pending. Local preview/provider review flags do not authorize downloading generated output.

## Source-preserving retry
POST /generation-jobs/{id}/retry with a NEW Idempotency-Key and JSON {} returns a normal new job using the exact private persisted request. Only original owner and failed/cancelled jobs; source, parent, deletion and permission checks run again. Successful/running jobs ->409 RETRY_NOT_ALLOWED; original key ->409 RETRY_KEY_REUSED. Duplicate retry key replays the same new job.
For a shared-parent request, body {share_token} must supply a currently valid capability because raw tokens are not persisted. Missing capability ->409 SHARE_TOKEN_REQUIRED; expired/revoked/mismatched capability ->404. Retrying never reconstructs full input from text_excerpt or transfers source ownership.
