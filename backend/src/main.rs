#[allow(dead_code)]
mod engine;
#[allow(dead_code)]
mod planning;
mod provider;
mod sharing;
use argon2::{
    password_hash::{PasswordHash, SaltString},
    Argon2, PasswordHasher, PasswordVerifier,
};
use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use rand_core::OsRng;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::Cursor,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
#[derive(Clone)]
struct App {
    db: Arc<Mutex<Connection>>,
    demo: bool,
    local_review: bool,
    web_dist: Option<std::path::PathBuf>,
    cpu_slots: Arc<tokio::sync::Semaphore>,
    secure: bool,
    provider: Option<provider::HttpProvider>,
}
#[derive(Debug)]
struct ErrApi(StatusCode, &'static str, String);
type R<T> = Result<T, ErrApi>;
impl IntoResponse for ErrApi {
    fn into_response(self) -> Response {
        (
            self.0,
            Json(json!({"error":{"code":self.1,"message":self.2}})),
        )
            .into_response()
    }
}
fn err(s: StatusCode, c: &'static str, m: &str) -> ErrApi {
    ErrApi(s, c, m.into())
}
impl From<rusqlite::Error> for ErrApi {
    fn from(e: rusqlite::Error) -> Self {
        eprintln!("database: {e}");
        err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "STORAGE_ERROR",
            "Storage operation failed",
        )
    }
}
fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}
fn field<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(Value::as_str).unwrap_or("")
}
fn init(db: Connection, demo: bool) -> App {
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,hash TEXT NOT NULL,settings TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),mime TEXT NOT NULL,bytes BLOB NOT NULL); CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),idem TEXT NOT NULL,request TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(user_id,idem)); CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),world TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,version_id TEXT NOT NULL,reason TEXT NOT NULL); CREATE TABLE IF NOT EXISTS video_ledger(job_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,day TEXT NOT NULL); ").expect("database schema");
    sharing::schema(&db);
    db.execute_batch("CREATE TABLE IF NOT EXISTS auth_attempts(email_hash TEXT NOT NULL,at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS auth_attempt_time ON auth_attempts(at);").expect("auth rate schema");
    let rows: Vec<(String, String)> = db
        .prepare("SELECT id,data FROM jobs")
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    for (id, s) in rows {
        let mut v: Value = serde_json::from_str(&s).unwrap();
        if v["status"] == "running" || v["status"] == "queued" {
            v["status"] = json!("failed");
            v["stage"] = json!("interrupted");
            v["error"] = json!({"code":"WORKER_RESTARTED","message":"Server restarted; retry with a new request key"});
            db.execute(
                "UPDATE jobs SET data=? WHERE id=?",
                params![v.to_string(), id],
            )
            .unwrap();
        }
    }
    App {
        provider: None,
        local_review: false,
        web_dist: None,
        cpu_slots: Arc::new(tokio::sync::Semaphore::new(2)),
        db: Arc::new(Mutex::new(db)),
        demo,
        secure: std::env::var("EUPRA_SECURE_COOKIE").as_deref() == Ok("1"),
    }
}
fn user(a: &App, h: &HeaderMap) -> R<String> {
    let cookie = h
        .get(header::COOKIE)
        .and_then(|s| s.to_str().ok())
        .unwrap_or("");
    let token = cookie
        .split(';')
        .filter_map(|p| p.trim().split_once('='))
        .find(|(k, _)| *k == "eupra_session")
        .map(|(_, v)| v)
        .unwrap_or("");
    let hash = format!("{:x}", Sha256::digest(token.as_bytes()));
    a.db.lock()
        .unwrap()
        .query_row(
            "SELECT user_id FROM sessions WHERE token=? AND expires>?",
            params![hash, now()],
            |r| r.get(0),
        )
        .optional()?
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "AUTH_REQUIRED", "Please sign in"))
}
fn owned(a: &App, table: &str, key: &str, uid: &str) -> R<Value> {
    let sql = format!("SELECT data FROM {table} WHERE id=? AND user_id=?");
    let s: Option<String> =
        a.db.lock()
            .unwrap()
            .query_row(&sql, params![key, uid], |r| r.get(0))
            .optional()?;
    s.map(|s| {
        let mut v: Value = serde_json::from_str(&s).unwrap();
        if table == "versions" && v.get("favorite").is_none() {
            v["favorite"] = json!(false);
        }
        v
    })
    .ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"))
}
fn routes(a: App) -> Router {
    Router::new()
        .route("/api/v1/config", get(config))
        .route("/api/v1/auth/register", post(register))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/auth/me", get(me))
        .route("/api/v1/uploads", post(upload))
        .route("/api/v1/uploads/{id}", get(upload_get))
        .route("/api/v1/generation-jobs", post(create_job))
        .route("/api/v1/generation-jobs/{id}", get(job_get))
        .route("/api/v1/generation-jobs/{id}/cancel", post(cancel))
        .route("/api/v1/versions/{id}", get(version_get))
        .route("/api/v1/versions/{id}/children", get(children))
        .route("/api/v1/versions/{id}/save", post(save))
        .route("/api/v1/versions/{id}/remix-permission", patch(permission))
        .route("/api/v1/versions/{id}/publish", post(publish))
        .route("/api/v1/story-worlds/{id}", get(world))
        .route("/api/v1/me/works", get(works))
        .route("/api/v1/me/settings", get(settings).patch(settings_patch))
        .route("/api/v1/me/video-credits", get(credits))
        .route("/api/v1/share-links", post(sharing::create))
        .route("/api/v1/share-links/{id}/revoke", post(sharing::revoke))
        .route("/api/v1/me/share-links", get(sharing::links))
        .route("/api/v1/me/review-queue", get(sharing::queue))
        .route("/api/v1/versions/{id}/local-review", post(sharing::review))
        .route("/api/v1/versions/{id}/reviews", get(sharing::reviews))
        .route(
            "/api/v1/versions/{id}/contributions",
            get(sharing::contributions),
        )
        .route("/api/v1/versions/{id}/favorite", patch(favorite))
        .route("/api/v1/me/story-worlds", get(story_worlds))
        .route("/api/v1/share/{token}", get(sharing::read))
        .route("/api/v1/reports", post(report))
        .fallback(static_fallback)
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024 + 65536))
        .with_state(a)
}
async fn config(State(a): State<App>) -> Json<Value> {
    Json(
        json!({"market":"CN","locale":"zh-CN","provider":if a.demo {"demo"}else if a.provider.is_some(){"http"}else{"unavailable"},"generation_enabled":a.demo||a.provider.is_some(),"demo":a.demo,"features":{"community":false,"video":false,"payments":false,"local_review":a.local_review,"share_preview":a.local_review},"upload":{"max_bytes":10485760,"mime_types":["image/jpeg","image/png","image/webp"]},"video":{"daily_limit":2,"successful_today":0},"policy_version":"20261020"}),
    )
}
fn auth(a: &App, v: Value, new: bool) -> R<Response> {
    let email = field(&v, "email").trim().to_lowercase();
    let pw = field(&v, "password");
    if !email.contains('@') || email.len() > 254 || pw.len() < 10 || pw.len() > 256 {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_CREDENTIALS",
            "Valid email and password (10–256 bytes) required",
        ));
    }
    let uid = if new {
        let uid = id();
        let hash = Argon2::default()
            .hash_password(pw.as_bytes(), &SaltString::generate(&mut OsRng))
            .map_err(|_| {
                err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "AUTH_ERROR",
                    "Password hashing failed",
                )
            })?
            .to_string();
        if a.db
            .lock()
            .unwrap()
            .execute(
                "INSERT INTO users VALUES(?,?,?,?)",
                params![
                    uid,
                    email,
                    hash,
                    json!({"locale":"zh-CN","market":"CN","default_remix_allowed":true})
                        .to_string()
                ],
            )
            .is_err()
        {
            return Err(err(
                StatusCode::CONFLICT,
                "ACCOUNT_EXISTS",
                "Account already exists",
            ));
        }
        uid
    } else {
        let row: Option<(String, String)> =
            a.db.lock()
                .unwrap()
                .query_row("SELECT id,hash FROM users WHERE email=?", [&email], |r| {
                    Ok((r.get(0)?, r.get(1)?))
                })
                .optional()?;
        let (uid, hash) = row.ok_or_else(|| {
            err(
                StatusCode::UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                "Invalid email or password",
            )
        })?;
        if Argon2::default()
            .verify_password(pw.as_bytes(), &PasswordHash::new(&hash).unwrap())
            .is_err()
        {
            return Err(err(
                StatusCode::UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                "Invalid email or password",
            ));
        }
        uid
    };
    let token = format!("{}{}", id(), id());
    let hash = format!("{:x}", Sha256::digest(token.as_bytes()));
    a.db.lock().unwrap().execute(
        "INSERT INTO sessions VALUES(?,?,?)",
        params![hash, uid, now() + 7 * 86400],
    )?;
    let cookie = format!(
        "eupra_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800{}",
        if a.secure { "; Secure" } else { "" }
    );
    Ok((
        [(header::SET_COOKIE, cookie)],
        Json(json!({"user":{"id":uid,"email":email}})),
    )
        .into_response())
}
async fn register(State(a): State<App>, Json(v): Json<Value>) -> R<Response> {
    auth_async(a, v, true).await
}
async fn login(State(a): State<App>, Json(v): Json<Value>) -> R<Response> {
    auth_async(a, v, false).await
}
async fn me(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let email: String =
        a.db.lock()
            .unwrap()
            .query_row("SELECT email FROM users WHERE id=?", [&uid], |r| r.get(0))?;
    Ok(Json(json!({"user":{"id":uid,"email":email}})))
}
async fn logout(State(a): State<App>, h: HeaderMap) -> R<Response> {
    let cookie = h
        .get(header::COOKIE)
        .and_then(|s| s.to_str().ok())
        .unwrap_or("");
    if let Some((_, t)) = cookie
        .split(';')
        .filter_map(|p| p.trim().split_once('='))
        .find(|(k, _)| *k == "eupra_session")
    {
        a.db.lock().unwrap().execute(
            "DELETE FROM sessions WHERE token=?",
            [format!("{:x}", Sha256::digest(t.as_bytes()))],
        )?;
    }
    Ok((
        [(
            header::SET_COOKIE,
            "eupra_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        )],
        Json(json!({"ok":true})),
    )
        .into_response())
}
async fn upload(State(a): State<App>, h: HeaderMap, mut m: Multipart) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let f = m
        .next_field()
        .await
        .map_err(|_| {
            err(
                StatusCode::BAD_REQUEST,
                "INVALID_UPLOAD",
                "Invalid multipart upload",
            )
        })?
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "INVALID_UPLOAD", "Image required"))?;
    let b = f.bytes().await.map_err(|_| {
        err(
            StatusCode::PAYLOAD_TOO_LARGE,
            "UPLOAD_TOO_LARGE",
            "Maximum upload is 10 MB",
        )
    })?;
    if b.len() > 10485760 {
        return Err(err(
            StatusCode::PAYLOAD_TOO_LARGE,
            "UPLOAD_TOO_LARGE",
            "Maximum upload is 10 MB",
        ));
    }
    let permit = a.cpu_slots.clone().try_acquire_owned().map_err(|_| {
        err(
            StatusCode::TOO_MANY_REQUESTS,
            "IMAGE_BUSY",
            "Please retry shortly",
        )
    })?;
    let bytes = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        normalize_upload(&b)
    })
    .await
    .map_err(|_| {
        err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "IMAGE_ERROR",
            "Image worker unavailable",
        )
    })??;
    let key = id();
    a.db.lock().unwrap().execute(
        "INSERT INTO uploads VALUES(?,?,?,?)",
        params![key, uid, "image/png", bytes],
    )?;
    Ok(Json(
        json!({"id":key,"mime_type":"image/png","size":bytes.len(),"url":format!("/api/v1/uploads/{key}")}),
    ))
}
async fn upload_get(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Response> {
    let uid = user(&a, &h)?;
    let b: Option<Vec<u8>> =
        a.db.lock()
            .unwrap()
            .query_row(
                "SELECT bytes FROM uploads WHERE id=? AND user_id=?",
                params![key, uid],
                |r| r.get(0),
            )
            .optional()?;
    Ok((
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "private, no-store"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        b.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"))?,
    )
        .into_response())
}
async fn create_job(
    State(a): State<App>,
    h: HeaderMap,
    Json(mut v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    if !v.is_object() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_REQUEST",
            "JSON object required",
        ));
    }
    for k in [
        "kind",
        "action",
        "text",
        "user_text",
        "source_id",
        "parent_version_id",
        "source_version_id",
        "locale",
        "idempotency_key",
        "share_token",
    ] {
        if v.get(k).is_some_and(|x| !x.is_string() && !x.is_null()) {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_REQUEST",
                "String fields required",
            ));
        }
    }
    if v.get("kind").is_none() {
        v["kind"] = json!(match field(&v, "action") {
            "MAKE_IT_HAPPEN" => "first_twist",
            "PUSH_FURTHER" => "continuation",
            "VIDEO_5S" => "video",
            _ => "",
        });
    }
    if v.get("text").is_none() {
        v["text"] = json!(field(&v, "user_text"));
    }
    if v.get("parent_version_id").is_none() {
        v["parent_version_id"] = json!(field(&v, "source_version_id"));
    }
    let idem = h
        .get("Idempotency-Key")
        .and_then(|x| x.to_str().ok())
        .unwrap_or(field(&v, "idempotency_key"))
        .to_owned();
    if idem.is_empty() || idem.len() > 128 {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "IDEMPOTENCY_REQUIRED",
            "Idempotency-Key (1–128 bytes) required",
        ));
    }
    let existing: Option<(String, String)> =
        a.db.lock()
            .unwrap()
            .query_row(
                "SELECT request,data FROM jobs WHERE user_id=? AND idem=?",
                params![uid, idem],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
    if let Some((request, data)) = existing {
        if request != request_record(&v) {
            return Err(err(
                StatusCode::CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                "Key already used for a different request",
            ));
        }
        return Ok(Json(serde_json::from_str(&data).unwrap()));
    }
    let locale = field(&v, "locale");
    if !locale.is_empty() && locale != "zh-CN" && locale != "en" {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_LOCALE",
            "Supported locales: zh-CN, en",
        ));
    }
    let kind = field(&v, "kind");
    if !matches!(kind, "first_twist" | "continuation" | "video") {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_KIND",
            "Unsupported generation kind",
        ));
    }
    if kind == "video" {
        return Err(err(
            StatusCode::SERVICE_UNAVAILABLE,
            "VIDEO_UNAVAILABLE",
            "Video provider is not configured; no credits charged",
        ));
    }
    if field(&v, "text").chars().count() > 2000 {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INPUT_TOO_LONG",
            "Maximum 2000 characters",
        ));
    }
    let parent = field(&v, "parent_version_id");
    if kind == "continuation" {
        let p = sharing::parent(
            &a.db.lock().unwrap(),
            parent,
            &uid,
            field(&v, "share_token"),
            a.local_review && a.demo,
        )?;
        if p["remix_allowed"] != true {
            return Err(err(
                StatusCode::FORBIDDEN,
                "REMIX_DISABLED",
                "Remix permission is disabled",
            ));
        }
    } else if !parent.is_empty() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_PARENT",
            "Use continuation for an existing version",
        ));
    }
    let src = field(&v, "source_id");
    if !src.is_empty() {
        let exists: bool = a.db.lock().unwrap().query_row(
            "SELECT EXISTS(SELECT 1 FROM uploads WHERE id=? AND user_id=?)",
            params![src, uid],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(err(
                StatusCode::NOT_FOUND,
                "SOURCE_NOT_FOUND",
                "Source not found",
            ));
        }
    }
    if kind == "first_twist" && src.is_empty() && field(&v, "text").trim().is_empty() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INPUT_REQUIRED",
            "Add text or an image",
        ));
    }
    if !a.demo && a.provider.is_none() {
        return Err(err(
            StatusCode::SERVICE_UNAVAILABLE,
            "PROVIDER_UNAVAILABLE",
            "AI generation and safety providers are not configured",
        ));
    }
    let key = id();
    let job = json!({"id":key,"status":"queued","stage":"REQUEST_INTAKE","version_id":null,"error":null,"demo":a.demo,"created_at":now(),"input_summary":{"kind":kind,"text_excerpt":field(&v,"text").chars().take(80).collect::<String>(),"source_id":if src.is_empty(){Value::Null}else{json!(src)},"source_url":if src.is_empty(){Value::Null}else{json!(format!("/api/v1/uploads/{src}"))},"parent_version_id":if parent.is_empty(){Value::Null}else{json!(parent)},"locale":if locale.is_empty(){"zh-CN"}else{locale}}});
    {
        let db = a.db.lock().unwrap();
        let raced: Option<(String, String)> = db
            .query_row(
                "SELECT request,data FROM jobs WHERE user_id=? AND idem=?",
                params![uid, idem],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if let Some((request, data)) = raced {
            if request != request_record(&v) {
                return Err(err(
                    StatusCode::CONFLICT,
                    "IDEMPOTENCY_CONFLICT",
                    "Key already used for a different request",
                ));
            }
            return Ok(Json(serde_json::from_str(&data).unwrap()));
        }
        let active:i64=db.query_row("SELECT count(*) FROM jobs WHERE user_id=? AND json_extract(data,'$.status') IN ('queued','running')",[&uid],|r|r.get(0))?;
        let global_active: i64 = db.query_row(
            "SELECT count(*) FROM jobs WHERE json_extract(data,'$.status') IN ('queued','running')",
            [],
            |r| r.get(0),
        )?;
        if global_active >= 16 {
            return Err(err(
                StatusCode::TOO_MANY_REQUESTS,
                "SERVER_BUSY",
                "Generation capacity is busy; retry shortly",
            ));
        }
        if active >= 2 {
            return Err(err(
                StatusCode::TOO_MANY_REQUESTS,
                "TOO_MANY_JOBS",
                "Two jobs are already active",
            ));
        }
        db.execute(
            "INSERT INTO jobs VALUES(?,?,?,?,?)",
            params![key, uid, idem, request_record(&v), job.to_string()],
        )?;
    }
    let aa = a.clone();
    let key2 = key.clone();
    tokio::spawn(async move {
        if aa.demo {
            run_demo(aa, key2, uid, v).await;
        } else {
            provider::run(aa, key2, uid, v).await;
        }
    });
    Ok(Json(job))
}
async fn run_demo(a: App, key: String, uid: String, v: Value) {
    {
        let db = a.db.lock().unwrap();
        let updated=db.execute("UPDATE jobs SET data=json_set(data,'$.status','running','$.stage','DEMO_TEMPLATE_PREPARATION') WHERE id=? AND json_extract(data,'$.status')='queued'",[&key]);
        if !matches!(updated, Ok(1)) {
            return;
        }
    }
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    let mut db = a.db.lock().unwrap();
    let result = (|| -> Result<(), rusqlite::Error> {
        let tx = db.transaction()?;
        let data: String =
            tx.query_row("SELECT data FROM jobs WHERE id=?", [&key], |r| r.get(0))?;
        let mut job: Value = serde_json::from_str(&data).unwrap();
        if job["status"] == "cancelled" {
            return Ok(());
        }
        let parent = field(&v, "parent_version_id");
        let p: Option<Value> = if parent.is_empty() {
            None
        } else {
            match sharing::parent(
                &tx,
                parent,
                &uid,
                field(&v, "share_token"),
                a.local_review && a.demo,
            ) {
                Ok(p) => Some(p),
                Err(e) => {
                    job["status"] = json!("failed");
                    job["stage"] = json!("FAILED");
                    job["error"] = json!({"code":e.1,"message":e.2});
                    tx.execute(
                        "UPDATE jobs SET data=? WHERE id=?",
                        params![job.to_string(), key],
                    )?;
                    tx.commit()?;
                    return Ok(());
                }
            }
        };
        if p.as_ref().is_some_and(|p| p["remix_allowed"] != true) {
            job["status"] = json!("failed");
            job["error"] =
                json!({"code":"REMIX_DISABLED","message":"Parent remix permission changed"});
            tx.execute(
                "UPDATE jobs SET data=? WHERE id=?",
                params![job.to_string(), key],
            )?;
            tx.commit()?;
            return Ok(());
        }
        let vid = id();
        let world = p
            .as_ref()
            .map(|p| field(p, "story_world_id").to_owned())
            .unwrap_or_else(id);
        let root = p
            .as_ref()
            .map(|p| field(p, "root_version_id").to_owned())
            .unwrap_or_else(|| vid.clone());
        let depth =
            p.as_ref().and_then(|p| p["depth"].as_u64()).unwrap_or(0) + u64::from(p.is_some());
        let en = field(&v, "locale") == "en";
        let anchor = p
            .as_ref()
            .map(|p| field(&p["story_memory"], "anchor").to_owned())
            .unwrap_or_else(|| {
                if field(&v, "text").is_empty() {
                    if en {
                        "Your uploaded image".into()
                    } else {
                        "你上传的日常照片".into()
                    }
                } else {
                    field(&v, "text").chars().take(120).collect()
                }
            });
        let (title, caption) = if en {
            if depth == 0 {
                ("The ordinary has filed a formal complaint".to_string(),format!("{anchor}: the Committee for Everyday Exceptions now requires a three-page explanation for every predictable outcome."))
            } else {
                (format!("Exception committee, case #{}",depth+1),"The committee's own paperwork has requested annual leave. All approvals now require a stamp from the office plant.".into())
            }
        } else if depth == 0 {
            ("日常事务正式提出异议".into(),format!("{anchor}：日常例外委员会宣布，所有意料之中的结果，现在都必须提交三页情况说明。"))
        } else {
            (
                format!("例外委员会第 {} 号补充通知", depth + 1),
                "委员会的申请表申请了年假。从今天起，所有审批须由办公室绿植盖章。".into(),
            )
        };
        let settings: String =
            tx.query_row("SELECT settings FROM users WHERE id=?", [&uid], |r| {
                r.get(0)
            })?;
        let settings: Value = serde_json::from_str(&settings).unwrap();
        let version = json!({"id":vid,"root_version_id":root,"parent_version_id":if parent.is_empty(){Value::Null}else{json!(parent)},"story_world_id":world,"creator_id":uid,"title":title,"caption":caption,"image_url":null,"source_id":if field(&v,"source_id").is_empty(){Value::Null}else{json!(field(&v,"source_id"))},"favorite":false,"kind":field(&v,"kind"),"depth":depth,"remix_allowed":settings["default_remix_allowed"],"safety_state":"HOLD","demo":true,"created_at":now(),"story_memory":{"anchor":anchor,"immutable_facts":["An everyday exception committee exists"],"open_loops":["Who authorized the committee?"],"recent_genes":["A03","A04","A07"],"depth":depth},"engine":{"provider":"demo","label":"DEMO: template text only, not AI generation","quality_evaluated":false,"safety_reviewed":false}});
        tx.execute(
            "INSERT INTO versions VALUES(?,?,?,?)",
            params![vid, uid, world, version.to_string()],
        )?;
        sharing::contribution(&tx, &vid, &root, p.as_ref(), &uid)?;
        job["status"] = json!("succeeded");
        job["stage"] = json!("DEMO_DRAFT");
        job["version_id"] = json!(vid);
        tx.execute(
            "UPDATE jobs SET data=? WHERE id=?",
            params![job.to_string(), key],
        )?;
        tx.commit()?;
        Ok(())
    })();
    if let Err(e) = result {
        eprintln!("demo worker error: {e}");
        let _=db.execute("UPDATE jobs SET data=json_set(data,'$.status','failed','$.stage','FAILED','$.error',json('{\"code\":\"WORKER_ERROR\",\"message\":\"Generation worker failed\"}')) WHERE id=? AND json_extract(data,'$.status') IN ('queued','running')",[&key]);
    }
}
async fn job_get(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    Ok(Json(owned(&a, "jobs", &key, &user(&a, &h)?)?))
}
async fn cancel(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction()?;
    let data: Option<String> = tx
        .query_row(
            "SELECT data FROM jobs WHERE id=? AND user_id=?",
            params![key, uid],
            |r| r.get(0),
        )
        .optional()?;
    let mut v: Value = serde_json::from_str(
        &data.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"))?,
    )
    .unwrap();
    if v["status"] == "queued" || v["status"] == "running" {
        v["status"] = json!("cancelled");
        v["stage"] = json!("CANCELLED");
        tx.execute(
            "UPDATE jobs SET data=? WHERE id=?",
            params![v.to_string(), key],
        )?;
    }
    tx.commit()?;
    Ok(Json(v))
}
async fn version_get(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    Ok(Json(owned(&a, "versions", &key, &user(&a, &h)?)?))
}
fn list(a: &App, uid: &str) -> R<Vec<Value>> {
    let db = a.db.lock().unwrap();
    let mut q = db.prepare("SELECT data FROM versions WHERE user_id=? ORDER BY rowid DESC")?;
    let data = q
        .query_map([uid], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(data
        .into_iter()
        .map(|s| {
            let mut v: Value = serde_json::from_str(&s).unwrap();
            if v.get("favorite").is_none() {
                v["favorite"] = json!(false);
            }
            v
        })
        .collect())
}
async fn works(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    Ok(Json(json!({"items":list(&a,&user(&a,&h)?)?})))
}
async fn children(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    owned(&a, "versions", &key, &uid)?;
    Ok(Json(
        json!({"items":list(&a,&uid)?.into_iter().filter(|v|v["parent_version_id"]==key).collect::<Vec<_>>()}),
    ))
}
async fn world(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    let items: Vec<Value> = list(&a, &user(&a, &h)?)?
        .into_iter()
        .filter(|v| v["story_world_id"] == key)
        .collect();
    if items.is_empty() {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"));
    }
    let owned_ids: std::collections::HashSet<String> = items
        .iter()
        .filter_map(|v| v["id"].as_str().map(str::to_owned))
        .collect();
    let mut refs = std::collections::BTreeSet::new();
    for v in &items {
        for field in ["root_version_id", "parent_version_id"] {
            if let Some(id) = v[field].as_str() {
                if !owned_ids.contains(id) {
                    refs.insert(id.to_owned());
                }
            }
        }
    }
    let ancestor_references: Vec<Value> = refs
        .into_iter()
        .map(|id| json!({"id":id,"access":"private","content_available":false}))
        .collect();
    Ok(Json(
        json!({"id":key,"items":items,"ancestor_references":ancestor_references}),
    ))
}
async fn save(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    owned(&a, "versions", &key, &user(&a, &h)?)?;
    Ok(Json(json!({"ok":true,"version_id":key})))
}
async fn permission(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    owned(&a, "versions", &key, &uid)?;
    let flag = v["remix_allowed"].as_bool().ok_or_else(|| {
        err(
            StatusCode::BAD_REQUEST,
            "INVALID_PERMISSION",
            "remix_allowed must be boolean",
        )
    })?;
    a.db.lock().unwrap().execute("UPDATE versions SET data=json_set(data,'$.remix_allowed',json(?)) WHERE id=? AND user_id=?",params![flag.to_string(),key,uid])?;
    Ok(Json(owned(&a, "versions", &key, &uid)?))
}
async fn settings(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let data: String =
        a.db.lock()
            .unwrap()
            .query_row("SELECT settings FROM users WHERE id=?", [uid], |r| r.get(0))?;
    Ok(Json(serde_json::from_str(&data).unwrap()))
}
async fn settings_patch(
    State(a): State<App>,
    h: HeaderMap,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let mut old = settings(State(a.clone()), h).await?.0;
    if let Some(l) = v.get("locale") {
        if l != "en" && l != "zh-CN" {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_LOCALE",
                "Supported locales: zh-CN, en",
            ));
        }
        old["locale"] = l.clone();
    }
    if let Some(b) = v.get("default_remix_allowed") {
        if !b.is_boolean() {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_SETTING",
                "Boolean required",
            ));
        }
        old["default_remix_allowed"] = b.clone();
    }
    a.db.lock().unwrap().execute(
        "UPDATE users SET settings=? WHERE id=?",
        params![old.to_string(), uid],
    )?;
    Ok(Json(old))
}
async fn credits(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    user(&a, &h)?;
    Ok(Json(
        json!({"daily_limit":2,"successful_today":0,"remaining":2,"enabled":false}),
    ))
}
async fn publish(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    owned(&a, "versions", &key, &user(&a, &h)?)?;
    Err(err(
        StatusCode::FORBIDDEN,
        "FEATURE_DISABLED",
        "Public community is not available in CN mode",
    ))
}
async fn report(State(a): State<App>, h: HeaderMap, Json(v): Json<Value>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let vid = field(&v, "version_id");
    owned(&a, "versions", vid, &uid)?;
    let reason = field(&v, "reason");
    if reason.trim().is_empty() || reason.len() > 4000 {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_REPORT",
            "Report reason required (maximum 4000 bytes)",
        ));
    }
    let key = id();
    a.db.lock().unwrap().execute(
        "INSERT INTO reports VALUES(?,?,?,?)",
        params![key, uid, vid, reason],
    )?;
    Ok(Json(json!({"id":key,"status":"received"})))
}
#[tokio::main]
async fn main() {
    let path = std::env::var("EUPRA_DATABASE").unwrap_or("eupra.sqlite3".into());
    let mut a = init(
        Connection::open(path).expect("open database"),
        std::env::var("EUPRA_PROVIDER").as_deref() == Ok("demo"),
    );
    if std::env::var("EUPRA_PROVIDER").as_deref() == Ok("http") {
        a.provider = Some(provider::HttpProvider::from_env().expect("HTTP provider configuration"));
    }
    if let Ok(dir) = std::env::var("EUPRA_WEB_DIST") {
        let dir = std::path::PathBuf::from(dir);
        assert!(
            dir.is_absolute() && dir.join("index.html").is_file(),
            "EUPRA_WEB_DIST must be an absolute built frontend directory"
        );
        a.web_dist = Some(dir);
    }
    let addr = std::env::var("EUPRA_BIND").unwrap_or("127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("bind listener");
    if std::env::var("EUPRA_LOCAL_REVIEW").as_deref() == Ok("1") {
        assert!(
            listener.local_addr().unwrap().ip().is_loopback(),
            "Local review requires loopback-only bind"
        );
        a.local_review = true;
    }
    eprintln!(
        "Eupra API listening on {addr}; provider={}",
        if a.demo {
            "DEMO (not AI)"
        } else if a.provider.is_some() {
            "http (configured external engine)"
        } else {
            "unavailable"
        }
    );
    axum::serve(listener, routes(a)).await.unwrap();
}
#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use tower::ServiceExt;
    pub(super) async fn request(
        app: &Router,
        method: &str,
        path: &str,
        cookie: &str,
        body: Value,
        key: &str,
    ) -> (StatusCode, Value, String) {
        let mut req = axum::http::Request::builder()
            .method(method)
            .uri(path)
            .header("Content-Type", "application/json");
        if !cookie.is_empty() {
            req = req.header("Cookie", cookie)
        }
        if !key.is_empty() {
            req = req.header("Idempotency-Key", key)
        }
        let res = app
            .clone()
            .oneshot(req.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap();
        let status = res.status();
        let cookie = res
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap()
            .to_owned();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        (
            status,
            serde_json::from_slice(&bytes).unwrap_or(Value::Null),
            cookie,
        )
    }
    pub(super) async fn account(app: &Router, email: &str) -> String {
        let (s, _, c) = request(
            app,
            "POST",
            "/api/v1/auth/register",
            "",
            json!({"email":email,"password":"test-password-long"}),
            "",
        )
        .await;
        assert_eq!(s, StatusCode::OK);
        c
    }
    #[tokio::test]
    async fn unavailable_is_default() {
        let app = routes(init(Connection::open_in_memory().unwrap(), false));
        let c = account(&app, "a@example.test").await;
        let (s, v, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"first_twist","text":"cat"}),
            "a",
        )
        .await;
        assert_eq!(s, 503);
        assert_eq!(v["error"]["code"], "PROVIDER_UNAVAILABLE");
    }
    #[tokio::test]
    async fn lineage_idempotency_ownership_and_hold() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let c = account(&app, "a@example.test").await;
        let d = account(&app, "b@example.test").await;
        let body = json!({"kind":"first_twist","text":"cat"});
        let (s, j, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            body.clone(),
            "first",
        )
        .await;
        assert_eq!(s, 200);
        let (_, j2, _) = request(&app, "POST", "/api/v1/generation-jobs", &c, body, "first").await;
        assert_eq!(j["id"], j2["id"]);
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"first_twist","text":"dog"}),
            "first",
        )
        .await;
        assert_eq!(s, 409);
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let (_, j, _) = request(
            &app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", j["id"].as_str().unwrap()),
            &c,
            Value::Null,
            "",
        )
        .await;
        let vid = j["version_id"].as_str().unwrap();
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{vid}"),
            &d,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &c,
            json!({"version_id":vid}),
            "",
        )
        .await;
        assert_eq!(s, 409);
        let (_, child, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"action":"PUSH_FURTHER","source_version_id":vid}),
            "child",
        )
        .await;
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let (_, cj, _) = request(
            &app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", child["id"].as_str().unwrap()),
            &c,
            Value::Null,
            "",
        )
        .await;
        let (_, version, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{}", cj["version_id"].as_str().unwrap()),
            &c,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(version["parent_version_id"], vid);
        assert_eq!(version["root_version_id"], vid);
        assert_eq!(version["depth"], 1);
        let (s, _, _) = request(
            &app,
            "PATCH",
            &format!("/api/v1/versions/{vid}/remix-permission"),
            &c,
            json!({"remix_allowed":false}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"continuation","parent_version_id":vid}),
            "blocked",
        )
        .await;
        assert_eq!(s, 403);
        let count: i64 =
            a.db.lock()
                .unwrap()
                .query_row("SELECT count(*) FROM versions", [], |r| r.get(0))
                .unwrap();
        assert_eq!(count, 2);
    }
    #[tokio::test]
    async fn cancellation_no_version_video_no_charge() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let c = account(&app, "a@example.test").await;
        let (_, j, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"first_twist","text":"cat"}),
            "cancel",
        )
        .await;
        let (s, j, _) = request(
            &app,
            "POST",
            &format!(
                "/api/v1/generation-jobs/{}/cancel",
                j["id"].as_str().unwrap()
            ),
            &c,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(j["status"], "cancelled");
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let n: i64 =
            a.db.lock()
                .unwrap()
                .query_row("SELECT count(*) FROM versions", [], |r| r.get(0))
                .unwrap();
        assert_eq!(n, 0);
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"video"}),
            "video",
        )
        .await;
        assert_eq!(s, 503);
        let (_, v, _) = request(&app, "GET", "/api/v1/me/video-credits", &c, Value::Null, "").await;
        assert_eq!(v["remaining"], 2);
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn malformed_request_and_concurrent_replay() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let c = account(&app, "malformed@example.test").await;
        for v in [
            json!(1),
            json!([]),
            json!(null),
            json!({"kind":true}),
            json!({"kind":"first_twist","text":[]}),
        ] {
            let (s, _, _) = request(&app, "POST", "/api/v1/generation-jobs", &c, v, "bad").await;
            assert_eq!(s, 400);
        }
        let body = json!({"kind":"first_twist","text":"cat"});
        let futures = (0..20)
            .map(|_| {
                let app = app.clone();
                let c = c.clone();
                let body = body.clone();
                tokio::spawn(async move {
                    request(
                        &app,
                        "POST",
                        "/api/v1/generation-jobs",
                        &c,
                        body,
                        "same-key",
                    )
                    .await
                })
            })
            .collect::<Vec<_>>();
        let mut ids = std::collections::HashSet::new();
        for f in futures {
            let (s, v, _) = f.await.unwrap();
            assert_eq!(s, 200);
            ids.insert(v["id"].as_str().unwrap().to_owned());
        }
        assert_eq!(ids.len(), 1);
    }
    #[tokio::test]
    async fn worker_failure_is_terminal() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        a.db.lock().unwrap().execute_batch("CREATE TRIGGER fail_version BEFORE INSERT ON versions BEGIN SELECT RAISE(FAIL, 'forced test failure'); END;").unwrap();
        let app = routes(a);
        let c = account(&app, "fault@example.test").await;
        let (_, j, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"first_twist","text":"cat"}),
            "fault",
        )
        .await;
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let (_, j, _) = request(
            &app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", j["id"].as_str().unwrap()),
            &c,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(j["status"], "failed");
        assert_eq!(j["error"]["code"], "WORKER_ERROR");
    }
}
async fn favorite(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let favorite = v["favorite"].as_bool().ok_or_else(|| {
        err(
            StatusCode::BAD_REQUEST,
            "INVALID_FAVORITE",
            "favorite must be boolean",
        )
    })?;
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction()?;
    let raw: Option<String> = tx
        .query_row(
            "SELECT data FROM versions WHERE id=? AND user_id=?",
            params![key, uid],
            |r| r.get(0),
        )
        .optional()?;
    let mut version: Value = serde_json::from_str(
        &raw.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"))?,
    )
    .unwrap();
    version["favorite"] = json!(favorite);
    tx.execute(
        "UPDATE versions SET data=? WHERE id=?",
        params![version.to_string(), key],
    )?;
    tx.commit()?;
    Ok(Json(version))
}
async fn story_worlds(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let mut worlds = std::collections::BTreeMap::<String, Value>::new();
    for v in list(&a, &uid)? {
        let key = field(&v, "story_world_id").to_owned();
        let e=worlds.entry(key.clone()).or_insert_with(||json!({"id":key,"root_version_id":v["root_version_id"],"title":v["title"],"version_count":0,"updated_at":v["created_at"]}));
        e["version_count"] = json!(e["version_count"].as_u64().unwrap_or(0) + 1);
        if v["created_at"].as_i64() > e["updated_at"].as_i64() {
            e["updated_at"] = v["created_at"].clone();
        }
    }
    Ok(Json(
        json!({"items":worlds.into_values().collect::<Vec<_>>()}),
    ))
}

fn request_record(v: &Value) -> String {
    let mut copy = v.clone();
    if let Some(token) = copy.get("share_token").and_then(Value::as_str) {
        let digest = format!("{:x}", Sha256::digest(token.as_bytes()));
        copy["share_token"] = json!(format!("sha256:{digest}"));
    }
    copy.to_string()
}
async fn auth_async(a: App, v: Value, new: bool) -> R<Response> {
    let permit = a.cpu_slots.clone().try_acquire_owned().map_err(|_| {
        err(
            StatusCode::TOO_MANY_REQUESTS,
            "AUTH_BUSY",
            "Please retry shortly",
        )
    })?;
    let rate_key = format!(
        "{:x}",
        Sha256::digest(field(&v, "email").trim().to_lowercase().as_bytes())
    );
    {
        let mut db = a.db.lock().unwrap();
        let tx = db.transaction()?;
        tx.execute("DELETE FROM auth_attempts WHERE at<?", [now() - 900])?;
        let count: i64 = tx.query_row(
            "SELECT count(*) FROM auth_attempts WHERE email_hash=?",
            [&rate_key],
            |r| r.get(0),
        )?;
        let global: i64 = tx.query_row(
            "SELECT count(*) FROM auth_attempts WHERE at>?",
            [now() - 60],
            |r| r.get(0),
        )?;
        if count >= 10 || global >= 60 {
            return Err(err(
                StatusCode::TOO_MANY_REQUESTS,
                "AUTH_RATE_LIMIT",
                "Too many attempts; please try later",
            ));
        }
        tx.execute(
            "INSERT INTO auth_attempts VALUES(?,?)",
            params![rate_key, now()],
        )?;
        tx.commit()?;
    }
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        auth(&a, v, new)
    })
    .await
    .map_err(|_| {
        err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "AUTH_ERROR",
            "Authentication worker unavailable",
        )
    })?
}
async fn static_fallback(State(a): State<App>, request: axum::extract::Request) -> Response {
    use tower::ServiceExt;
    let path = request.uri().path();
    if path == "/api" || path.starts_with("/api/") {
        return err(StatusCode::NOT_FOUND, "NOT_FOUND", "API endpoint not found").into_response();
    }
    let Some(dir) = a.web_dist else {
        return err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found").into_response();
    };
    let index = dir.join("index.html");
    let response = tower_http::services::ServeDir::new(dir)
        .not_found_service(tower_http::services::ServeFile::new(index))
        .oneshot(request)
        .await;
    match response {
        Ok(r) => {
            let mut r = r.into_response();
            r.headers_mut()
                .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
            r.headers_mut()
                .insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
            r.headers_mut()
                .insert(header::REFERRER_POLICY, "no-referrer".parse().unwrap());
            r
        }
        Err(_) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "STATIC_ERROR",
            "Static frontend unavailable",
        )
        .into_response(),
    }
}

fn normalize_upload(b: &[u8]) -> R<Vec<u8>> {
    let fmt = image::guess_format(&b).map_err(|_| {
        err(
            StatusCode::BAD_REQUEST,
            "INVALID_IMAGE",
            "JPEG, PNG or WebP required",
        )
    })?;
    if !matches!(
        fmt,
        image::ImageFormat::Jpeg | image::ImageFormat::Png | image::ImageFormat::WebP
    ) {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_IMAGE",
            "JPEG, PNG or WebP required",
        ));
    }
    let mut reader = image::ImageReader::with_format(Cursor::new(&b), fmt);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let img = reader.decode().map_err(|_| {
        err(
            StatusCode::BAD_REQUEST,
            "INVALID_IMAGE",
            "Invalid or oversized image dimensions",
        )
    })?;
    let mut out = Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png)
        .map_err(|_| {
            err(
                StatusCode::BAD_REQUEST,
                "INVALID_IMAGE",
                "Image normalization failed",
            )
        })?;
    let bytes = out.into_inner();
    if bytes.len() > 20 * 1024 * 1024 {
        return Err(err(
            StatusCode::PAYLOAD_TOO_LARGE,
            "UPLOAD_TOO_LARGE",
            "Decoded image exceeds storage limit",
        ));
    }
    Ok(bytes)
}
#[cfg(test)]
mod local_regressions {
    use super::*;
    use crate::tests::{account, request};
    #[tokio::test]
    async fn auth_attempts_are_rate_limited() {
        let a = init(Connection::open_in_memory().unwrap(), false);
        let app = routes(a);
        for _ in 0..10 {
            let (s, _, _) = request(
                &app,
                "POST",
                "/api/v1/auth/login",
                "",
                json!({"email":"rate@local.test","password":"x"}),
                "",
            )
            .await;
            assert_eq!(s, 400);
        }
        let (s, v, _) = request(
            &app,
            "POST",
            "/api/v1/auth/login",
            "",
            json!({"email":"RATE@LOCAL.TEST","password":"x"}),
            "",
        )
        .await;
        assert_eq!(s, 429);
        assert_eq!(v["error"]["code"], "AUTH_RATE_LIMIT");
    }
    #[tokio::test]
    async fn favorite_and_permission_do_not_overwrite_review() {
        let mut a = init(Connection::open_in_memory().unwrap(), true);
        a.local_review = true;
        let app = routes(a);
        let c = account(&app, "favorite@local.test").await;
        let (_, j, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &c,
            json!({"kind":"first_twist","text":"cat"}),
            "f",
        )
        .await;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let (_, j, _) = request(
            &app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", j["id"].as_str().unwrap()),
            &c,
            Value::Null,
            "",
        )
        .await;
        let vid = j["version_id"].as_str().unwrap();
        request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/local-review"),
            &c,
            json!({"approved":true}),
            "",
        )
        .await;
        request(
            &app,
            "PATCH",
            &format!("/api/v1/versions/{vid}/favorite"),
            &c,
            json!({"favorite":true}),
            "",
        )
        .await;
        let (_, v, _) = request(
            &app,
            "PATCH",
            &format!("/api/v1/versions/{vid}/remix-permission"),
            &c,
            json!({"remix_allowed":false}),
            "",
        )
        .await;
        assert_eq!(v["favorite"], true);
        assert_eq!(v["local_preview_reviewed"], true);
        assert_eq!(v["remix_allowed"], false);
        let (_, worlds, _) =
            request(&app, "GET", "/api/v1/me/story-worlds", &c, Value::Null, "").await;
        assert_eq!(worlds["items"][0]["version_count"], 1);
    }
}
