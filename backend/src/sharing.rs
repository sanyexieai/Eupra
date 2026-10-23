//! Opt-in local text-preview capabilities. Never a production moderation/export bypass.
use super::*;
pub fn schema(db: &Connection) {
    db.execute_batch("CREATE TABLE IF NOT EXISTS local_reviews(id TEXT PRIMARY KEY,version_id TEXT NOT NULL,user_id TEXT NOT NULL,approved INTEGER NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS share_links(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,version_id TEXT NOT NULL,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,event TEXT NOT NULL,target TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS contributions(version_id TEXT PRIMARY KEY,root_creator_id TEXT NOT NULL,parent_creator_id TEXT,current_creator_id TEXT NOT NULL);").expect("sharing schema");
}
fn enabled(a: &App) -> R<()> {
    if !a.local_review {
        return Err(err(
            StatusCode::CONFLICT,
            "SAFETY_HOLD",
            "Production sharing is held; local preview is not enabled",
        ));
    }
    Ok(())
}
fn eligible(v: &Value) -> bool {
    v["demo"] == true && v["image_url"].is_null() && v["engine"]["provider"] == "demo"
}
fn hash(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
fn audit(db: &Connection, uid: &str, event: &str, target: &str) -> rusqlite::Result<()> {
    db.execute(
        "INSERT INTO audit_events VALUES(?,?,?,?,?)",
        params![id(), uid, event, target, now()],
    )?;
    Ok(())
}
pub async fn review(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    enabled(&a)?;
    let approved = v["approved"].as_bool().ok_or_else(|| {
        err(
            StatusCode::BAD_REQUEST,
            "INVALID_REVIEW",
            "approved boolean required",
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
    if !eligible(&version) {
        return Err(err(
            StatusCode::FORBIDDEN,
            "LOCAL_TEXT_ONLY",
            "Local manual preview is limited to demo text; never real model or image output",
        ));
    }
    let review_id = id();
    tx.execute(
        "INSERT INTO local_reviews VALUES(?,?,?,?,?)",
        params![review_id, key, uid, approved, now()],
    )?;
    version["local_preview_reviewed"] = json!(approved);
    version["local_preview_label"] = json!("Development preview · template text, not AI output");
    tx.execute(
        "UPDATE versions SET data=? WHERE id=?",
        params![version.to_string(), key],
    )?;
    if !approved {
        tx.execute(
            "UPDATE share_links SET revoked=1 WHERE version_id=?",
            [&key],
        )?;
    }
    audit(
        &tx,
        &uid,
        if approved {
            "local_preview_approved"
        } else {
            "local_preview_withdrawn"
        },
        &key,
    )?;
    tx.commit()?;
    Ok(Json(
        json!({"id":review_id,"version_id":key,"approved":approved,"development_preview":true,"safety_state":"HOLD"}),
    ))
}
pub async fn queue(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    enabled(&a)?;
    Ok(Json(
        json!({"items":list(&a,&uid)?.into_iter().filter(|v|eligible(v)&&v["local_preview_reviewed"]!=true).collect::<Vec<_>>(),"development_preview":true}),
    ))
}
pub async fn reviews(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    owned(&a, "versions", &key, &uid)?;
    let db = a.db.lock().unwrap();
    let mut q=db.prepare("SELECT id,approved,created_at FROM local_reviews WHERE version_id=? AND user_id=? ORDER BY created_at DESC,rowid DESC")?;
    let rows=q.query_map(params![key,uid],|r|Ok(json!({"id":r.get::<_,String>(0)?,"approved":r.get::<_,bool>(1)?,"created_at":r.get::<_,i64>(2)?,"review_type":"owner_local_demo_text","production_safety_approval":false})))?.collect::<Result<Vec<_>,_>>()?;
    Ok(Json(json!({"items":rows})))
}
pub async fn create(State(a): State<App>, h: HeaderMap, Json(v): Json<Value>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let key = field(&v, "version_id");
    owned(&a, "versions", key, &uid)?;
    enabled(&a)?;
    let ttl = v
        .get("expires_in_seconds")
        .map(|n| n.as_i64().unwrap_or(0))
        .unwrap_or(3600);
    if !(60..=86400).contains(&ttl) {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_EXPIRY",
            "Preview expiry must be 60–86400 seconds",
        ));
    }
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction()?;
    let raw: String = tx.query_row(
        "SELECT data FROM versions WHERE id=? AND user_id=?",
        params![key, uid],
        |r| r.get(0),
    )?;
    let version: Value = serde_json::from_str(&raw).unwrap();
    if !eligible(&version) || version["local_preview_reviewed"] != true {
        return Err(err(
            StatusCode::CONFLICT,
            "LOCAL_REVIEW_REQUIRED",
            "Review your demo text before creating a local preview link",
        ));
    }
    let link_id = id();
    let token = format!(
        "{}{}{}",
        id().replace('-', ""),
        id().replace('-', ""),
        id().replace('-', "")
    );
    let expires = now() + ttl;
    tx.execute("INSERT INTO share_links(id,token_hash,version_id,user_id,expires_at,created_at) VALUES(?,?,?,?,?,?)",params![link_id,hash(&token),key,uid,expires,now()])?;
    audit(&tx, &uid, "local_preview_link_created", &link_id)?;
    tx.commit()?;
    Ok(Json(
        json!({"id":link_id,"token":token,"url":format!("/share/{token}"),"expires_at":expires,"scope":"demo_text_preview","development_preview":true,"label":"Development preview · template text, not AI output"}),
    ))
}
pub async fn revoke(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction()?;
    let n = tx.execute(
        "UPDATE share_links SET revoked=1 WHERE id=? AND user_id=?",
        params![key, uid],
    )?;
    if n == 0 {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Not found"));
    }
    audit(&tx, &uid, "local_preview_link_revoked", &key)?;
    tx.commit()?;
    Ok(Json(json!({"ok":true,"id":key})))
}
pub async fn links(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    let mut q=db.prepare("SELECT id,version_id,expires_at,revoked FROM share_links WHERE user_id=? ORDER BY created_at DESC")?;
    let items=q.query_map([uid],|r|Ok(json!({"id":r.get::<_,String>(0)?,"version_id":r.get::<_,String>(1)?,"expires_at":r.get::<_,i64>(2)?,"revoked":r.get::<_,bool>(3)?})))?.collect::<Result<Vec<_>,_>>()?;
    Ok(Json(json!({"items":items})))
}
fn capability(db: &Connection, token: &str) -> R<(Value, i64)> {
    if token.len() != 96 {
        return Err(err(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Preview unavailable",
        ));
    }
    let row:Option<(String,i64)>=db.query_row("SELECT v.data,s.expires_at FROM share_links s JOIN versions v ON v.id=s.version_id WHERE s.token_hash=? AND s.revoked=0 AND s.expires_at>?",params![hash(token),now()],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
    let (raw, expiry) =
        row.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Preview unavailable"))?;
    let v: Value = serde_json::from_str(&raw).unwrap();
    if !eligible(&v) || v["local_preview_reviewed"] != true {
        return Err(err(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Preview unavailable",
        ));
    }
    Ok((v, expiry))
}
pub fn parent(db: &Connection, key: &str, uid: &str, token: &str, local: bool) -> R<Value> {
    let raw: Option<String> = db
        .query_row(
            "SELECT data FROM versions WHERE id=? AND user_id=?",
            params![key, uid],
            |r| r.get(0),
        )
        .optional()?;
    if let Some(raw) = raw {
        return Ok(serde_json::from_str(&raw).unwrap());
    }
    if !local {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Parent not found"));
    }
    let (mut v, _) = capability(db, token)?;
    if v["id"] != key {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Parent not found"));
    }
    if v["remix_allowed"] != true {
        return Err(err(
            StatusCode::FORBIDDEN,
            "REMIX_DISABLED",
            "Author disabled remix",
        ));
    }
    v["source_id"] = Value::Null;
    v["story_memory"]["anchor"] = v["title"].clone();
    Ok(v)
}
pub async fn read(State(a): State<App>, Path(token): Path<String>) -> R<Response> {
    enabled(&a)?;
    let (v, expires) = capability(&a.db.lock().unwrap(), &token)?;
    let safe = json!({"id":v["id"],"root_version_id":v["root_version_id"],"parent_version_id":v["parent_version_id"],"story_world_id":v["story_world_id"],"creator_id":v["creator_id"],"title":v["title"],"caption":v["caption"],"image_url":null,"demo":true,"development_preview":true,"created_at":v["created_at"],"remix_allowed":v["remix_allowed"],"safety_state":"HOLD"});
    Ok(([(header::CACHE_CONTROL,"no-store"),(header::REFERRER_POLICY,"no-referrer")],Json(json!({"version":safe,"development_preview":true,"label":"Development preview · template text, not AI output","remix_allowed":v["remix_allowed"],"requires_auth":true,"expires_at":expires}))).into_response())
}
pub fn contribution(
    db: &Connection,
    vid: &str,
    root: &str,
    parent: Option<&Value>,
    uid: &str,
) -> rusqlite::Result<()> {
    let root_creator: String = if vid == root {
        uid.into()
    } else {
        db.query_row("SELECT user_id FROM versions WHERE id=?", [root], |r| {
            r.get(0)
        })?
    };
    let parent_creator = parent.map(|v| field(v, "creator_id"));
    db.execute(
        "INSERT INTO contributions VALUES(?,?,?,?)",
        params![vid, root_creator, parent_creator, uid],
    )?;
    Ok(())
}
pub async fn contributions(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    owned(&a, "versions", &key, &uid)?;
    let row:Option<Value>=a.db.lock().unwrap().query_row("SELECT root_creator_id,parent_creator_id,current_creator_id FROM contributions WHERE version_id=?",[key],|r|Ok(json!({"root_creator_id":r.get::<_,String>(0)?,"parent_creator_id":r.get::<_,Option<String>>(1)?,"current_creator_id":r.get::<_,String>(2)?,"revenue_enabled":false}))).optional()?;
    Ok(Json(row.unwrap_or(
        json!({"revenue_enabled":false,"record_available":false}),
    )))
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::{account, request};
    async fn version(app: &Router, cookie: &str) -> String {
        let (_, j, _) = request(
            app,
            "POST",
            "/api/v1/generation-jobs",
            cookie,
            json!({"kind":"first_twist","text":"private text anchor"}),
            "root",
        )
        .await;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let (_, j, _) = request(
            app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", j["id"].as_str().unwrap()),
            cookie,
            Value::Null,
            "",
        )
        .await;
        j["version_id"].as_str().unwrap().into()
    }
    #[tokio::test]
    async fn local_share_scope_cross_account_lineage_and_revocation() {
        let mut a = init(Connection::open_in_memory().unwrap(), true);
        a.local_review = true;
        let app = routes(a.clone());
        let alice = account(&app, "alice@local.test").await;
        let bob = account(&app, "bob@local.test").await;
        let vid = version(&app, &alice).await;
        {
            let db = a.db.lock().unwrap();
            let owner: String = db
                .query_row("SELECT user_id FROM versions WHERE id=?", [&vid], |r| {
                    r.get(0)
                })
                .unwrap();
            db.execute(
                "INSERT INTO uploads VALUES('private-source',?,'image/png',?)",
                params![owner, vec![1u8, 2, 3]],
            )
            .unwrap();
            db.execute(
                "UPDATE versions SET data=json_set(data,'$.source_id','private-source') WHERE id=?",
                [&vid],
            )
            .unwrap();
        }
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &alice,
            json!({"version_id":vid}),
            "",
        )
        .await;
        assert_eq!(s, 409);
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/local-review"),
            &bob,
            json!({"approved":true}),
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/local-review"),
            &alice,
            json!({"approved":true}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        let (_, link, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &alice,
            json!({"version_id":vid}),
            "",
        )
        .await;
        let token = link["token"].as_str().unwrap();
        let (s, public, _) = request(
            &app,
            "GET",
            &format!("/api/v1/share/{token}"),
            "",
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(public["development_preview"], true);
        assert!(public["version"].get("source_id").is_none());
        assert!(public["version"].get("story_memory").is_none());
        assert!(public["version"].get("email").is_none());
        assert_eq!(public["version"]["safety_state"], "HOLD");
        let body = json!({"kind":"continuation","parent_version_id":vid,"share_token":token});
        let (s, job, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &bob,
            body.clone(),
            "relay",
        )
        .await;
        assert_eq!(s, 200);
        let (_, again, _) =
            request(&app, "POST", "/api/v1/generation-jobs", &bob, body, "relay").await;
        assert_eq!(job["id"], again["id"]);
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let (_, job, _) = request(
            &app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", job["id"].as_str().unwrap()),
            &bob,
            Value::Null,
            "",
        )
        .await;
        let child = job["version_id"].as_str().unwrap();
        let (_, v, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{child}"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(v["root_version_id"], vid);
        assert_eq!(v["parent_version_id"], vid);
        assert!(v["source_id"].is_null());
        let (_, edges, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{child}/contributions"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_ne!(edges["root_creator_id"], edges["current_creator_id"]);
        assert_eq!(edges["root_creator_id"], edges["parent_creator_id"]);
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{vid}"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let request_data: String =
            a.db.lock()
                .unwrap()
                .query_row(
                    "SELECT request FROM jobs WHERE id=?",
                    [job["id"].as_str().unwrap()],
                    |r| r.get(0),
                )
                .unwrap();
        assert!(!request_data.contains(token));
        let (s, _, _) = request(
            &app,
            "POST",
            &format!(
                "/api/v1/share-links/{}/revoke",
                link["id"].as_str().unwrap()
            ),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "POST",
            &format!(
                "/api/v1/share-links/{}/revoke",
                link["id"].as_str().unwrap()
            ),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
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
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &bob,
            json!({"kind":"continuation","parent_version_id":vid,"share_token":token}),
            "revoked",
        )
        .await;
        assert_eq!(s, 404);
        let (s, _, _) = request(
            &app,
            "GET",
            "/api/v1/uploads/private-source",
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, grand, _) = request(
            &app,
            "POST",
            "/api/v1/generation-jobs",
            &bob,
            json!({"kind":"continuation","parent_version_id":child}),
            "grandchild",
        )
        .await;
        assert_eq!(s, 200);
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let (_, grand, _) = request(
            &app,
            "GET",
            &format!("/api/v1/generation-jobs/{}", grand["id"].as_str().unwrap()),
            &bob,
            Value::Null,
            "",
        )
        .await;
        let (_, grand, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{}", grand["version_id"].as_str().unwrap()),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(grand["root_version_id"], vid);
        assert_eq!(grand["parent_version_id"], child);
        let (_, world, _) = request(
            &app,
            "GET",
            &format!(
                "/api/v1/story-worlds/{}",
                grand["story_world_id"].as_str().unwrap()
            ),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(world["items"].as_array().unwrap().len(), 2);
        assert_eq!(world["ancestor_references"][0]["id"], vid);
        assert_eq!(world["ancestor_references"][0]["content_available"], false);
    }
    #[tokio::test]
    async fn expiry_withdrawal_and_production_output_cannot_be_approved() {
        let mut a = init(Connection::open_in_memory().unwrap(), true);
        a.local_review = true;
        let app = routes(a.clone());
        let c = account(&app, "review@local.test").await;
        let vid = version(&app, &c).await;
        request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/local-review"),
            &c,
            json!({"approved":true}),
            "",
        )
        .await;
        let (_, link, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &c,
            json!({"version_id":vid}),
            "",
        )
        .await;
        a.db.lock()
            .unwrap()
            .execute("UPDATE share_links SET expires_at=?", [now() - 1])
            .unwrap();
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/share/{}", link["token"].as_str().unwrap()),
            "",
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (_, link, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &c,
            json!({"version_id":vid}),
            "",
        )
        .await;
        request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/local-review"),
            &c,
            json!({"approved":false}),
            "",
        )
        .await;
        let (s, _, _) = request(
            &app,
            "GET",
            &format!("/api/v1/share/{}", link["token"].as_str().unwrap()),
            "",
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 404);
        a.db.lock()
            .unwrap()
            .execute(
                "UPDATE versions SET data=json_set(data,'$.demo',json('false')) WHERE id=?",
                [&vid],
            )
            .unwrap();
        let (s, _, _) = request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/local-review"),
            &c,
            json!({"approved":true}),
            "",
        )
        .await;
        assert_eq!(s, 403);
    }
}
