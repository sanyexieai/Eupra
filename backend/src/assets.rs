//! Private editable drafts and recoverable work visibility. Never erase immutable lineage.
use super::*;
use axum::extract::Query;
#[derive(serde::Deserialize, Default)]
pub struct View {
    pub state: Option<String>,
}
fn view(q: &View) -> R<&str> {
    let s = q.state.as_deref().unwrap_or("active");
    if !matches!(s, "active" | "trash" | "all") {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_STATE",
            "state must be active, trash or all",
        ));
    }
    Ok(s)
}
pub fn schema(db: &Connection) {
    db.execute_batch("CREATE TABLE IF NOT EXISTS work_states(version_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,deleted_at INTEGER,updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER);").expect("asset schema");
}
pub fn active(db: &Connection, key: &str) -> R<()> {
    let deleted: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM work_states WHERE version_id=? AND deleted_at IS NOT NULL)",
        [key],
        |r| r.get(0),
    )?;
    if deleted {
        return Err(err(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Work is unavailable",
        ));
    }
    Ok(())
}
pub fn versions(a: &App, uid: &str, state: &str) -> R<Vec<Value>> {
    let db = a.db.lock().unwrap();
    let mut q=db.prepare("SELECT v.data,w.deleted_at FROM versions v LEFT JOIN work_states w ON w.version_id=v.id WHERE v.user_id=? AND (?='all' OR (?='trash' AND w.deleted_at IS NOT NULL) OR (?='active' AND w.deleted_at IS NULL)) ORDER BY v.rowid DESC")?;
    let rows = q
        .query_map(params![uid, state, state, state], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Option<i64>>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows
        .into_iter()
        .map(|(raw, deleted)| {
            let mut v: Value = serde_json::from_str(&raw).unwrap();
            if v.get("favorite").is_none() {
                v["favorite"] = json!(false)
            }
            v["deleted_at"] = json!(deleted);
            v
        })
        .collect())
}
pub async fn works(State(a): State<App>, h: HeaderMap, Query(q): Query<View>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    Ok(Json(json!({"items":versions(&a,&uid,view(&q)?)?})))
}
pub async fn trash_work(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction()?;
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM versions WHERE id=? AND user_id=?)",
        params![key, uid],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"));
    }
    tx.execute("INSERT INTO work_states VALUES(?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET deleted_at=COALESCE(work_states.deleted_at,excluded.deleted_at),updated_at=excluded.updated_at",params![key,uid,now(),now()])?;
    tx.execute(
        "UPDATE share_links SET revoked=1 WHERE version_id=? AND user_id=?",
        params![key, uid],
    )?;
    tx.execute("UPDATE versions SET data=json_set(data,'$.local_preview_reviewed',json('false')) WHERE id=? AND user_id=?",params![key,uid])?;
    tx.execute(
        "INSERT INTO audit_events VALUES(?,?,?,?,?)",
        params![id(), uid, "work_soft_deleted", key, now()],
    )?;
    let deleted: i64 = tx.query_row(
        "SELECT deleted_at FROM work_states WHERE version_id=?",
        [&key],
        |r| r.get(0),
    )?;
    tx.commit()?;
    Ok(Json(json!({"ok":true,"id":key,"deleted_at":deleted})))
}
pub async fn restore_work(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    {
        let mut db = a.db.lock().unwrap();
        let tx = db.transaction()?;
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM versions WHERE id=? AND user_id=?)",
            params![key, uid],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"));
        }
        tx.execute(
            "UPDATE work_states SET deleted_at=NULL,updated_at=? WHERE version_id=? AND user_id=?",
            params![now(), key, uid],
        )?;
        tx.execute(
            "INSERT INTO audit_events VALUES(?,?,?,?,?)",
            params![id(), uid, "work_restored", key, now()],
        )?;
        tx.commit()?;
    }
    let mut v = owned(&a, "versions", &key, &uid)?;
    v["deleted_at"] = Value::Null;
    Ok(Json(v))
}
pub async fn export_permission(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    owned(&a, "versions", &key, &user(&a, &h)?)?;
    Ok(Json(
        json!({"allowed":false,"reason":"REVIEW_NOT_CONFIGURED","safety_state":"HOLD","scope":"none"}),
    ))
}
fn validate_draft(db: &Connection, uid: &str, v: &mut Value) -> R<()> {
    // UI uses a regional English locale; store the canonical engine/settings locale.
    if field(v, "locale") == "en-US" {
        v["locale"] = json!("en");
    }
    for (key, max) in [("title", 120), ("text", 2000)] {
        if !v[key].is_string() || field(v, key).chars().count() > max {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_DRAFT",
                "Draft title/text invalid or too long",
            ));
        }
    }
    if !matches!(field(v, "locale"), "zh-CN" | "en") {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_LOCALE",
            "Supported locales: zh-CN, en",
        ));
    }
    for k in ["source_id", "parent_version_id"] {
        if !v[k].is_null() && !v[k].is_string() {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_DRAFT",
                "Reference fields must be strings or null",
            ));
        }
    }
    let source = field(v, "source_id");
    if !source.is_empty() {
        let exists: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM uploads WHERE id=? AND user_id=?)",
            params![source, uid],
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
    let parent = field(v, "parent_version_id");
    if !parent.is_empty() {
        active(db, parent)?;
        let exists: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM versions WHERE id=? AND user_id=?)",
            params![parent, uid],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Parent not found"));
        }
    }
    Ok(())
}
fn data_fields(v: &Value) -> R<()> {
    if !v.is_object() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_DRAFT",
            "JSON object required",
        ));
    }
    if v.as_object().unwrap().keys().any(|k| {
        !matches!(
            k.as_str(),
            "title" | "text" | "source_id" | "parent_version_id" | "locale" | "expected_revision"
        )
    }) {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_DRAFT",
            "Unsupported draft field",
        ));
    }
    Ok(())
}
fn draft_dto(
    key: &str,
    raw: String,
    revision: i64,
    created: i64,
    updated: i64,
    deleted: Option<i64>,
) -> Value {
    let mut v: Value = serde_json::from_str(&raw).unwrap();
    v["id"] = json!(key);
    v["revision"] = json!(revision);
    v["created_at"] = json!(created);
    v["updated_at"] = json!(updated);
    v["deleted_at"] = json!(deleted);
    v["source_url"] = if field(&v, "source_id").is_empty() {
        Value::Null
    } else {
        json!(format!("/api/v1/uploads/{}", field(&v, "source_id")))
    };
    v
}
pub async fn create_draft(
    State(a): State<App>,
    h: HeaderMap,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    data_fields(&v)?;
    let mut data =
        json!({"title":"","text":"","source_id":null,"parent_version_id":null,"locale":"zh-CN"});
    for k in ["title", "text", "source_id", "parent_version_id", "locale"] {
        if let Some(value) = v.get(k) {
            data[k] = value.clone()
        }
    }
    let key = id();
    let created = now();
    let db = a.db.lock().unwrap();
    validate_draft(&db, &uid, &mut data)?;
    let count: i64 = db.query_row(
        "SELECT count(*) FROM drafts WHERE user_id=? AND deleted_at IS NULL",
        [&uid],
        |r| r.get(0),
    )?;
    if count >= 200 {
        return Err(err(
            StatusCode::CONFLICT,
            "DRAFT_LIMIT",
            "Maximum 200 active drafts",
        ));
    }
    db.execute(
        "INSERT INTO drafts VALUES(?,?,?,1,?,?,NULL)",
        params![key, uid, data.to_string(), created, created],
    )?;
    Ok(Json(draft_dto(
        &key,
        data.to_string(),
        1,
        created,
        created,
        None,
    )))
}
pub async fn list_drafts(
    State(a): State<App>,
    h: HeaderMap,
    Query(q): Query<View>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let state = view(&q)?;
    let db = a.db.lock().unwrap();
    let mut query=db.prepare("SELECT id,data,revision,created_at,updated_at,deleted_at FROM drafts WHERE user_id=? AND (?='all' OR (?='trash' AND deleted_at IS NOT NULL) OR (?='active' AND deleted_at IS NULL)) ORDER BY updated_at DESC,rowid DESC")?;
    let items = query
        .query_map(params![uid, state, state, state], |r| {
            Ok(draft_dto(
                &r.get::<_, String>(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Json(json!({"items":items})))
}
pub async fn get_draft(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let v:Option<Value>=a.db.lock().unwrap().query_row("SELECT data,revision,created_at,updated_at FROM drafts WHERE id=? AND user_id=? AND deleted_at IS NULL",params![key,uid],|r|Ok(draft_dto(&key,r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,None))).optional()?;
    Ok(Json(v.ok_or_else(|| {
        err(StatusCode::NOT_FOUND, "NOT_FOUND", "Draft not found")
    })?))
}
pub async fn patch_draft(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    data_fields(&v)?;
    let expected = v["expected_revision"]
        .as_i64()
        .filter(|n| *n > 0)
        .ok_or_else(|| {
            err(
                StatusCode::BAD_REQUEST,
                "REVISION_REQUIRED",
                "expected_revision is required",
            )
        })?;
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction()?;
    let row:Option<(String,i64,i64)>=tx.query_row("SELECT data,revision,created_at FROM drafts WHERE id=? AND user_id=? AND deleted_at IS NULL",params![key,uid],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()?;
    let (raw, revision, created) =
        row.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Draft not found"))?;
    if revision != expected {
        return Err(err(
            StatusCode::CONFLICT,
            "REVISION_CONFLICT",
            "Draft changed; reload before saving",
        ));
    }
    let mut data: Value = serde_json::from_str(&raw).unwrap();
    for k in ["title", "text", "source_id", "parent_version_id", "locale"] {
        if let Some(value) = v.get(k) {
            data[k] = value.clone()
        }
    }
    validate_draft(&tx, &uid, &mut data)?;
    let updated = now();
    tx.execute(
        "UPDATE drafts SET data=?,revision=revision+1,updated_at=? WHERE id=?",
        params![data.to_string(), updated, key],
    )?;
    tx.commit()?;
    Ok(Json(draft_dto(
        &key,
        data.to_string(),
        revision + 1,
        created,
        updated,
        None,
    )))
}
pub async fn trash_draft(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    let n=db.execute("UPDATE drafts SET deleted_at=COALESCE(deleted_at,?),updated_at=?,revision=revision+CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END WHERE id=? AND user_id=?",params![now(),now(),key,uid])?;
    if n == 0 {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Draft not found"));
    }
    Ok(Json(json!({"ok":true,"id":key})))
}
pub async fn restore_draft(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    {
        let mut db = a.db.lock().unwrap();
        let tx = db.transaction()?;
        let row: Option<Option<i64>> = tx
            .query_row(
                "SELECT deleted_at FROM drafts WHERE id=? AND user_id=?",
                params![key, uid],
                |r| r.get(0),
            )
            .optional()?;
        let deleted =
            row.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Draft not found"))?;
        if deleted.is_some() {
            let count: i64 = tx.query_row(
                "SELECT count(*) FROM drafts WHERE user_id=? AND deleted_at IS NULL",
                [&uid],
                |r| r.get(0),
            )?;
            if count >= 200 {
                return Err(err(
                    StatusCode::CONFLICT,
                    "DRAFT_LIMIT",
                    "Maximum 200 active drafts",
                ));
            }
            tx.execute("UPDATE drafts SET deleted_at=NULL,updated_at=?,revision=revision+1 WHERE id=? AND user_id=?",params![now(),key,uid])?;
        }
        tx.commit()?;
    }
    get_draft(State(a), h, Path(key)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::{account, request};
    async fn make(app: &Router, c: &str, key: &str, parent: Option<&str>) -> String {
        let v = if let Some(parent) = parent {
            json!({"kind":"continuation","parent_version_id":parent})
        } else {
            json!({"kind":"first_twist","text":"private original"})
        };
        let (_, j, _) = request(app, "POST", "/api/v1/generation-jobs", c, v, key).await;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let (_, j, _) = request(
            app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", j["id"].as_str().unwrap()),
            c,
            Value::Null,
            "",
        )
        .await;
        j["version_id"].as_str().unwrap().into()
    }
    #[tokio::test]
    async fn draft_http_regional_english_normalizes_on_create_and_revision_patch() {
        let app = routes(init(Connection::open_in_memory().unwrap(), true));
        let cookie = account(&app, "locale-draft@local.test").await;
        let (status, draft, _) = request(
            &app,
            "POST",
            "/api/v1/me/drafts",
            &cookie,
            json!({"text":"English idea", "locale":"en-US"}),
            "",
        )
        .await;
        assert_eq!(status, 200);
        assert_eq!(draft["locale"], "en");
        assert_eq!(draft["revision"], 1);
        let path = format!("/api/v1/drafts/{}", draft["id"].as_str().unwrap());
        let (status, updated, _) = request(
            &app,
            "PATCH",
            &path,
            &cookie,
            json!({"expected_revision":1,"locale":"en-US","text":"Revised English idea"}),
            "",
        )
        .await;
        assert_eq!(status, 200);
        assert_eq!(updated["locale"], "en");
        assert_eq!(updated["revision"], 2);
        let (status, stored, _) = request(&app, "GET", &path, &cookie, Value::Null, "").await;
        assert_eq!(status, 200);
        assert_eq!(stored["locale"], "en");
        assert_eq!(stored["text"], "Revised English idea");
        assert_eq!(stored["revision"], 2);
        let (status, _, _) = request(
            &app,
            "PATCH",
            &path,
            &cookie,
            json!({"expected_revision":1,"locale":"en-US"}),
            "",
        )
        .await;
        assert_eq!(status, 409);
        let (status, _, _) = request(
            &app,
            "PATCH",
            &path,
            &cookie,
            json!({"expected_revision":2,"locale":"unsupported"}),
            "",
        )
        .await;
        assert_eq!(status, 400);
    }
    #[tokio::test]
    async fn private_drafts_revision_source_and_recovery() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let alice = account(&app, "draft-a@local.test").await;
        let bob = account(&app, "draft-b@local.test").await;
        let (_, me, _) = request(&app, "GET", "/api/v1/auth/me", &alice, Value::Null, "").await;
        let uid = me["user"]["id"].as_str().unwrap();
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO uploads VALUES('owned-image',?,'image/png',?)",
                params![uid, vec![1u8]],
            )
            .unwrap();
        let (s, d, _) = request(
            &app,
            "POST",
            "/api/v1/me/drafts",
            &alice,
            json!({"title":"Saved idea","text":"full private text","source_id":"owned-image"}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        let path = format!("/api/v1/drafts/{}", d["id"].as_str().unwrap());
        assert_eq!(d["source_url"], "/api/v1/uploads/owned-image");
        let (s, _, _) = request(&app, "GET", &path, &bob, Value::Null, "").await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/me/drafts",
            &bob,
            json!({"source_id":"owned-image"}),
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, d, _) = request(
            &app,
            "PATCH",
            &path,
            &alice,
            json!({"expected_revision":1,"text":"updated full text"}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(d["revision"], 2);
        let (s, _, _) = request(
            &app,
            "PATCH",
            &path,
            &alice,
            json!({"expected_revision":1,"text":"stale write"}),
            "",
        )
        .await;
        assert_eq!(s, 409);
        let (s, _, _) = request(&app, "DELETE", &path, &bob, Value::Null, "").await;
        assert_eq!(s, 404);
        let (s, _, _) = request(&app, "DELETE", &path, &alice, Value::Null, "").await;
        assert_eq!(s, 200);
        let (_, list, _) = request(&app, "GET", "/api/v1/me/drafts", &alice, Value::Null, "").await;
        assert!(list["items"].as_array().unwrap().is_empty());
        let (_, trash, _) = request(
            &app,
            "GET",
            "/api/v1/me/drafts?state=trash",
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(trash["items"][0]["text"], "updated full text");
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("{path}/restore"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, d, _) = request(
            &app,
            "POST",
            &format!("{path}/restore"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(d["text"], "updated full text");
        assert_eq!(d["revision"], 4);
    }
    #[tokio::test]
    async fn work_trash_preserves_lineage_revokes_links_and_blocks_pending_child() {
        let mut a = init(Connection::open_in_memory().unwrap(), true);
        a.local_review = true;
        let app = routes(a.clone());
        let alice = account(&app, "trash-a@local.test").await;
        let bob = account(&app, "trash-b@local.test").await;
        let root = make(&app, &alice, "root", None).await;
        let child = make(&app, &alice, "child", Some(&root)).await;
        request(
            &app,
            "POST",
            &format!("/api/v1/versions/{root}/local-review"),
            &alice,
            json!({"approved":true}),
            "",
        )
        .await;
        let (_, link, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &alice,
            json!({"version_id":root}),
            "",
        )
        .await;
        let token = link["token"].as_str().unwrap();
        let (_, pending, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &alice,
            json!({"kind":"continuation","parent_version_id":root}),
            "pending",
        )
        .await;
        let (s, _, _) = request(
            &app,
            "DELETE",
            &format!("/api/v1/versions/{root}"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "DELETE",
            &format!("/api/v1/versions/{root}"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        let (_, works, _) = request(&app, "GET", "/api/v1/me/works", &alice, Value::Null, "").await;
        assert_eq!(works["items"].as_array().unwrap().len(), 1);
        assert_eq!(works["items"][0]["id"], child);
        let (_, trash, _) = request(
            &app,
            "GET",
            "/api/v1/me/works?state=trash",
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(trash["items"][0]["id"], root);
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{root}/export-permission"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/share/{token}"),
            "",
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let (_, j, _) = request(
            &app,
            "GET",
            &format!(
                "/api/v1/generation-jobs/{}",
                pending["id"].as_str().unwrap()
            ),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(j["status"], "failed");
        let (_, v, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{child}"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(v["root_version_id"], root);
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("/api/v1/versions/{root}/restore"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, v, _) = request(
            &app,
            "POST",
            &format!("/api/v1/versions/{root}/restore"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["local_preview_reviewed"], false);
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/share/{token}"),
            "",
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (_, permission, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{root}/export-permission"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(permission["allowed"], false);
        assert_eq!(permission["reason"], "REVIEW_NOT_CONFIGURED");
        let count: i64 =
            a.db.lock()
                .unwrap()
                .query_row("SELECT count(*) FROM versions", [], |r| r.get(0))
                .unwrap();
        assert_eq!(count, 2);
    }
    #[tokio::test]
    async fn retry_keeps_full_input_and_requires_new_owner_key() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let alice = account(&app, "retry-a@local.test").await;
        let bob = account(&app, "retry-b@local.test").await;
        let full = "Original text beyond the eighty-character summary. ".repeat(10);
        let (_, job, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &alice,
            json!({"kind":"first_twist","text":full}),
            "original",
        )
        .await;
        let path = format!("/api/v1/generation-jobs/{}", job["id"].as_str().unwrap());
        request(
            &app,
            "POST",
            &format!("{path}/cancel"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("{path}/retry"),
            &bob,
            json!({}),
            "retry",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("{path}/retry"),
            &alice,
            json!({}),
            "original",
        )
        .await;
        assert_eq!(s, 409);
        let (s, next, _) = request(
            &app,
            "POST",
            &format!("{path}/retry"),
            &alice,
            json!({}),
            "retry",
        )
        .await;
        assert_eq!(s, 200);
        let (_, again, _) = request(
            &app,
            "POST",
            &format!("{path}/retry"),
            &alice,
            json!({}),
            "retry",
        )
        .await;
        assert_eq!(next["id"], again["id"]);
        let raw: String =
            a.db.lock()
                .unwrap()
                .query_row(
                    "SELECT request FROM jobs WHERE id=?",
                    [next["id"].as_str().unwrap()],
                    |r| r.get(0),
                )
                .unwrap();
        let original: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(original["text"], full);
    }
    #[tokio::test]
    async fn restoring_draft_respects_active_quota() {
        let a = init(Connection::open_in_memory().unwrap(), false);
        let app = routes(a.clone());
        let c = account(&app, "quota@local.test").await;
        let (_, me, _) = request(&app, "GET", "/api/v1/auth/me", &c, Value::Null, "").await;
        let uid = me["user"]["id"].as_str().unwrap();
        {
            let mut db = a.db.lock().unwrap();
            let tx = db.transaction().unwrap();
            for n in 0..201 {
                tx.execute("INSERT INTO drafts VALUES(?,?,?,1,?,?,?)",params![format!("quota-{n}"),uid,json!({"title":"","text":"","source_id":null,"parent_version_id":null,"locale":"en"}).to_string(),now(),now(),if n==200{Some(now())}else{None}]).unwrap();
            }
            tx.commit().unwrap();
        }
        let (s, v, _) = request(
            &app,
            "POST",
            "/api/v1/drafts/quota-200/restore",
            &c,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 409);
        assert_eq!(v["error"]["code"], "DRAFT_LIMIT");
        let (s, v, _) = request(
            &app,
            "POST",
            "/api/v1/drafts/quota-0/restore",
            &c,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["revision"], 1);
        request(
            &app,
            "DELETE",
            "/api/v1/drafts/quota-0",
            &c,
            Value::Null,
            "",
        )
        .await;
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/drafts/quota-200/restore",
            &c,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
    }
}
