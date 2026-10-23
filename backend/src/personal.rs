//! Private CN personal controls. No public profile or moderation/export authority.
use super::*;
pub fn schema(db: &Connection) {
    db.execute_batch("CREATE TABLE IF NOT EXISTS motion_preferences(version_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,data TEXT NOT NULL,updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS appeals(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,version_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);").expect("personal schema");
}
fn profile_data(db: &Connection, uid: &str) -> R<Value> {
    let row: Option<(String, i64)> = db
        .query_row(
            "SELECT data,updated_at FROM profiles WHERE user_id=?",
            [uid],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let (mut v, updated) = match row {
        Some((s, t)) => (serde_json::from_str::<Value>(&s).unwrap(), Some(t)),
        None => (json!({"nickname":"","bio":"","avatar_asset_id":null}), None),
    };
    v["user_id"] = json!(uid);
    v["updated_at"] = json!(updated);
    v["avatar_url"] = if let Some(id) = v["avatar_asset_id"].as_str() {
        json!(format!("/api/v1/uploads/{id}"))
    } else {
        Value::Null
    };
    Ok(v)
}
pub async fn profile(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    Ok(Json(profile_data(&db, &uid)?))
}
pub async fn patch_profile(
    State(a): State<App>,
    h: HeaderMap,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let obj = v.as_object().ok_or_else(|| {
        err(
            StatusCode::BAD_REQUEST,
            "INVALID_PROFILE",
            "Object required",
        )
    })?;
    if obj
        .keys()
        .any(|k| !matches!(k.as_str(), "nickname" | "bio" | "avatar_asset_id"))
    {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_PROFILE",
            "Unsupported profile field",
        ));
    }
    let db = a.db.lock().unwrap();
    let mut old = profile_data(&db, &uid)?;
    for (k, max) in [("nickname", 40), ("bio", 500)] {
        if let Some(val) = v.get(k) {
            let s = val
                .as_str()
                .ok_or_else(|| err(StatusCode::BAD_REQUEST, "INVALID_PROFILE", "Text required"))?;
            if s.chars().count() > max || s.chars().any(|c| c.is_control() && c != '\n') {
                return Err(err(
                    StatusCode::BAD_REQUEST,
                    "INVALID_PROFILE",
                    "Profile text invalid or too long",
                ));
            }
            old[k] = json!(s.trim());
        }
    }
    if let Some(val) = v.get("avatar_asset_id") {
        if !val.is_null() {
            let id = val.as_str().ok_or_else(|| {
                err(
                    StatusCode::BAD_REQUEST,
                    "INVALID_PROFILE",
                    "Avatar must be an owned upload ID or null",
                )
            })?;
            let exists: bool = db.query_row(
                "SELECT EXISTS(SELECT 1 FROM uploads WHERE id=? AND user_id=?)",
                params![id, uid],
                |r| r.get(0),
            )?;
            if !exists {
                return Err(err(
                    StatusCode::NOT_FOUND,
                    "NOT_FOUND",
                    "Avatar upload not found",
                ));
            }
        }
        old["avatar_asset_id"] = val.clone();
    }
    let data = json!({"nickname":old["nickname"],"bio":old["bio"],"avatar_asset_id":old["avatar_asset_id"]});
    db.execute("INSERT INTO profiles VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",params![uid,data.to_string(),now()])?;
    Ok(Json(profile_data(&db, &uid)?))
}
pub async fn summary(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    let (works,worlds):(i64,i64)=db.query_row("SELECT count(*),count(DISTINCT v.world) FROM versions v LEFT JOIN work_states w ON w.version_id=v.id WHERE v.user_id=? AND w.deleted_at IS NULL",[&uid],|r|Ok((r.get(0)?,r.get(1)?)))?;
    let drafts: i64 = db.query_row(
        "SELECT count(*) FROM drafts WHERE user_id=? AND deleted_at IS NULL",
        [&uid],
        |r| r.get(0),
    )?;
    let trash: i64 = db.query_row(
        "SELECT count(*) FROM work_states WHERE user_id=? AND deleted_at IS NOT NULL",
        [&uid],
        |r| r.get(0),
    )?;
    let mut stmt=db.prepare("SELECT v.data FROM versions v LEFT JOIN work_states w ON w.version_id=v.id WHERE v.user_id=? AND w.deleted_at IS NULL ORDER BY v.rowid DESC LIMIT 6")?;
    let recent=stmt.query_map([&uid],|r|r.get::<_,String>(0))?.collect::<Result<Vec<_>,_>>()?.into_iter().map(|s|{let v:Value=serde_json::from_str(&s).unwrap();json!({"id":v["id"],"title":v["title"],"image_url":v["image_url"],"story_world_id":v["story_world_id"],"root_version_id":v["root_version_id"],"parent_version_id":v["parent_version_id"],"creator_id":v["creator_id"],"demo":v["demo"],"created_at":v["created_at"]})}).collect::<Vec<_>>();
    Ok(Json(
        json!({"profile":profile_data(&db,&uid)?,"stats":{"worlds":worlds,"works":works,"versions":works,"drafts":drafts,"trashed_works":trash},"recent_versions":recent,"scope":"private_owned","community_enabled":false}),
    ))
}
pub async fn appeals(State(a): State<App>, h: HeaderMap) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    let mut q = db.prepare(
        "SELECT id,version_id,reason,created_at FROM appeals WHERE user_id=? ORDER BY rowid DESC",
    )?;
    let items=q.query_map([uid],|r|Ok(json!({"id":r.get::<_,String>(0)?,"version_id":r.get::<_,String>(1)?,"reason":r.get::<_,String>(2)?,"created_at":r.get::<_,i64>(3)?,"status":"pending_local","processing_enabled":false})))?.collect::<Result<Vec<_>,_>>()?;
    Ok(Json(json!({"items":items,"processing_enabled":false})))
}
pub async fn appeal(State(a): State<App>, h: HeaderMap, Json(v): Json<Value>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let obj = v
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "INVALID_APPEAL", "Object required"))?;
    if obj
        .keys()
        .any(|k| !matches!(k.as_str(), "version_id" | "reason"))
        || field(&v, "reason").trim().is_empty()
        || field(&v, "reason").chars().count() > 2000
    {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_APPEAL",
            "Version and reason up to 2000 characters required",
        ));
    }
    let db = a.db.lock().unwrap();
    let vid = field(&v, "version_id");
    let exists: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM versions WHERE id=? AND user_id=?)",
        params![vid, uid],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Version not found"));
    }
    let count: i64 = db.query_row(
        "SELECT count(*) FROM appeals WHERE user_id=?",
        [&uid],
        |r| r.get(0),
    )?;
    if count >= 100 {
        return Err(err(
            StatusCode::CONFLICT,
            "APPEAL_LIMIT",
            "Maximum 100 local appeal records",
        ));
    }
    let id = id();
    let t = now();
    db.execute(
        "INSERT INTO appeals VALUES(?,?,?,?,?)",
        params![id, uid, vid, field(&v, "reason").trim(), t],
    )?;
    Ok(Json(
        json!({"id":id,"version_id":vid,"reason":field(&v,"reason").trim(),"created_at":t,"status":"pending_local","processing_enabled":false}),
    ))
}

fn active_owner(db: &Connection, uid: &str, key: &str) -> R<()> {
    let exists:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM versions v LEFT JOIN work_states w ON w.version_id=v.id WHERE v.id=? AND v.user_id=? AND w.deleted_at IS NULL)",params![key,uid],|r|r.get(0))?;
    if !exists {
        return Err(err(StatusCode::NOT_FOUND, "NOT_FOUND", "Version not found"));
    }
    Ok(())
}
fn motion_data(db: &Connection, key: &str) -> R<Value> {
    let row: Option<(String, i64)> = db
        .query_row(
            "SELECT data,updated_at FROM motion_preferences WHERE version_id=?",
            [key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let (mut v, t) = match row {
        Some((s, t)) => (serde_json::from_str::<Value>(&s).unwrap(), Some(t)),
        None => (json!({"preset":"gentle","custom_text":""}), None),
    };
    v["version_id"] = json!(key);
    v["updated_at"] = json!(t);
    v["generation_enabled"] = json!(false);
    Ok(v)
}
pub async fn motion(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    active_owner(&db, &uid, &key)?;
    Ok(Json(motion_data(&db, &key)?))
}
pub async fn patch_motion(
    State(a): State<App>,
    h: HeaderMap,
    Path(key): Path<String>,
    Json(v): Json<Value>,
) -> R<Json<Value>> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    active_owner(&db, &uid, &key)?;
    let obj = v
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "INVALID_MOTION", "Object required"))?;
    if obj
        .keys()
        .any(|k| !matches!(k.as_str(), "preset" | "custom_text"))
    {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_MOTION",
            "Unsupported field",
        ));
    }
    let mut old = motion_data(&db, &key)?;
    if let Some(p) = v.get("preset") {
        if !matches!(
            p.as_str(),
            Some("gentle" | "dynamic" | "cinematic" | "custom")
        ) {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_MOTION",
                "Unsupported preset",
            ));
        }
        old["preset"] = p.clone();
    }
    if let Some(t) = v.get("custom_text") {
        if t.as_str().is_none_or(|s| {
            s.chars().count() > 500 || s.chars().any(|c| c.is_control() && c != '\n')
        }) {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "INVALID_MOTION",
                "Custom text must be at most 500 characters",
            ));
        }
        old["custom_text"] = t.clone();
    }
    let data = json!({"preset":old["preset"],"custom_text":old["custom_text"]});
    db.execute("INSERT INTO motion_preferences VALUES(?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",params![key,uid,data.to_string(),now()])?;
    Ok(Json(motion_data(&db, &key)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::{account, request};
    async fn fixture() -> (App, Router, String, String, String, String) {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let alice = account(&app, "personal-a@local.test").await;
        let bob = account(&app, "personal-b@local.test").await;
        let (_, m, _) = request(&app, "GET", "/api/v1/auth/me", &alice, Value::Null, "").await;
        let uid = m["user"]["id"].as_str().unwrap().to_string();
        let (_, m, _) = request(&app, "GET", "/api/v1/auth/me", &bob, Value::Null, "").await;
        let bid = m["user"]["id"].as_str().unwrap().to_string();
        (a, app, alice, bob, uid, bid)
    }
    fn seed(a: &App, uid: &str, id: &str, world: &str) {
        let v = json!({"id":id,"story_world_id":world,"root_version_id":id,"parent_version_id":null,"creator_id":uid,"title":"Owned title","image_url":null,"demo":true,"created_at":now(),"source_id":"PRIVATE_SOURCE","story_memory":{"secret":"PRIVATE_MEMORY"},"safety_state":"HOLD"});
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO versions VALUES(?,?,?,?)",
                params![id, uid, world, v.to_string()],
            )
            .unwrap();
    }
    #[tokio::test]
    async fn private_profile_avatar_validation_and_persistence() {
        let (a, app, alice, bob, uid, _) = fixture().await;
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO uploads VALUES('avatar-owned',?,'image/png',?)",
                params![uid, vec![1u8]],
            )
            .unwrap();
        let (s, p, _) = request(
            &app,
            "PATCH",
            "/api/v1/me/profile",
            &alice,
            json!({"nickname":"阿里","bio":"Private bio","avatar_asset_id":"avatar-owned"}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(p["nickname"], "阿里");
        assert_eq!(p["avatar_url"], "/api/v1/uploads/avatar-owned");
        assert!(p["updated_at"].is_i64());
        let (s, p, _) = request(&app, "GET", "/api/v1/me/profile", &alice, Value::Null, "").await;
        assert_eq!(s, 200);
        assert_eq!(p["bio"], "Private bio");
        let (_, p, _) = request(&app, "GET", "/api/v1/me/profile", &bob, Value::Null, "").await;
        assert_eq!(p["nickname"], "");
        assert!(p["avatar_url"].is_null());
        let (s, _, _) = request(
            &app,
            "PATCH",
            "/api/v1/me/profile",
            &bob,
            json!({"avatar_asset_id":"avatar-owned"}),
            "",
        )
        .await;
        assert_eq!(s, 404);
        for body in [
            json!({"avatar_url":"https://example.org"}),
            json!({"nickname":"x".repeat(41)}),
            json!([]),
            json!({"bio":5}),
        ] {
            let (s, _, _) = request(&app, "PATCH", "/api/v1/me/profile", &alice, body, "").await;
            assert_eq!(s, 400);
        }
        let (s, p, _) = request(
            &app,
            "PATCH",
            "/api/v1/me/profile",
            &alice,
            json!({"avatar_asset_id":null}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert!(p["avatar_url"].is_null());
        let (s, _, _) = request(&app, "GET", "/api/v1/me/profile", "", Value::Null, "").await;
        assert_eq!(s, 401);
    }
    #[tokio::test]
    async fn summary_counts_whole_account_excludes_trash_and_private_fields() {
        let (a, app, alice, _, uid, bid) = fixture().await;
        for i in 0..8 {
            seed(
                &a,
                &uid,
                &format!("a{i}"),
                if i < 4 { "world-a" } else { "world-b" },
            );
        }
        seed(&a, &bid, "foreign", "foreign-world");
        request(
            &app,
            "POST",
            "/api/v1/me/drafts",
            &alice,
            json!({"text":"scratch"}),
            "",
        )
        .await;
        request(
            &app,
            "DELETE",
            "/api/v1/versions/a0",
            &alice,
            Value::Null,
            "",
        )
        .await;
        let (s, v, _) = request(
            &app,
            "GET",
            "/api/v1/me/creator-summary",
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(
            v["stats"],
            json!({"worlds":2,"works":7,"versions":7,"drafts":1,"trashed_works":1})
        );
        assert_eq!(v["recent_versions"].as_array().unwrap().len(), 6);
        let raw = v.to_string();
        for marker in [
            "PRIVATE_SOURCE",
            "PRIVATE_MEMORY",
            "foreign-world",
            "personal-a@",
        ] {
            assert!(!raw.contains(marker));
        }
    }
    #[tokio::test]
    async fn motion_and_appeals_are_private_non_generating_and_preserve_artwork() {
        let (a, app, alice, bob, uid, _) = fixture().await;
        seed(&a, &uid, "motion-work", "world");
        let before: String =
            a.db.lock()
                .unwrap()
                .query_row(
                    "SELECT data FROM versions WHERE id='motion-work'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
        let path = "/api/v1/versions/motion-work/motion-preference";
        let (s, v, _) = request(
            &app,
            "PATCH",
            path,
            &alice,
            json!({"preset":"custom","custom_text":"Slow camera pan"}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["generation_enabled"], false);
        let (_, v, _) = request(&app, "GET", path, &alice, Value::Null, "").await;
        assert_eq!(v["custom_text"], "Slow camera pan");
        for method in ["GET", "PATCH"] {
            let (s, _, _) =
                request(&app, method, path, &bob, json!({"preset":"dynamic"}), "").await;
            assert_eq!(s, 404);
        }
        for body in [
            json!({"preset":"invalid"}),
            json!({"custom_text":"x".repeat(501)}),
            json!({"url":"http://example.org"}),
        ] {
            let (s, _, _) = request(&app, "PATCH", path, &alice, body, "").await;
            assert_eq!(s, 400);
        }
        let after: String =
            a.db.lock()
                .unwrap()
                .query_row(
                    "SELECT data FROM versions WHERE id='motion-work'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
        assert_eq!(before, after);
        let (s, _, _) = request(
            &app,
            "POST",
            "/api/v1/me/appeals",
            &bob,
            json!({"version_id":"motion-work","reason":"claim"}),
            "",
        )
        .await;
        assert_eq!(s, 404);
        let (s, v, _) = request(
            &app,
            "POST",
            "/api/v1/me/appeals",
            &alice,
            json!({"version_id":"motion-work","reason":"Please reconsider locally"}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["status"], "pending_local");
        assert_eq!(v["processing_enabled"], false);
        let (_, v, _) = request(&app, "GET", "/api/v1/me/appeals", &bob, Value::Null, "").await;
        assert!(v["items"].as_array().unwrap().is_empty());
        request(
            &app,
            "DELETE",
            "/api/v1/versions/motion-work",
            &alice,
            Value::Null,
            "",
        )
        .await;
        let (s, _, _) = request(&app, "PATCH", path, &alice, json!({"preset":"dynamic"}), "").await;
        assert_eq!(s, 404);
        let (s, v, _) = request(
            &app,
            "POST",
            "/api/v1/me/appeals",
            &alice,
            json!({"version_id":"motion-work","reason":"Own trashed work"}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["status"], "pending_local");
        let jobs: i64 =
            a.db.lock()
                .unwrap()
                .query_row("SELECT count(*) FROM jobs", [], |r| r.get(0))
                .unwrap();
        assert_eq!(jobs, 0);
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn settings_concurrency_and_disabled_quota_truthfulness() {
        let (_, app, alice, _, _, _) = fixture().await;
        let a = app.clone();
        let c = alice.clone();
        let one = tokio::spawn(async move {
            request(
                &a,
                "PATCH",
                "/api/v1/me/settings",
                &c,
                json!({"locale":"en-US"}),
                "",
            )
            .await
        });
        let a = app.clone();
        let c = alice.clone();
        let two = tokio::spawn(async move {
            request(
                &a,
                "PATCH",
                "/api/v1/me/settings",
                &c,
                json!({"notifications_enabled":true}),
                "",
            )
            .await
        });
        assert_eq!(one.await.unwrap().0, 200);
        assert_eq!(two.await.unwrap().0, 200);
        let (_, v, _) = request(&app, "GET", "/api/v1/me/settings", &alice, Value::Null, "").await;
        assert_eq!(v["locale"], "en");
        assert_eq!(v["notifications_enabled"], true);
        let (_, v, _) = request(
            &app,
            "GET",
            "/api/v1/me/video-credits",
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(v["enabled"], false);
        assert_eq!(v["available_now"], 0);
        assert_eq!(v["accounting_active"], false);
        assert_eq!(v["timezone"], "UTC");
        assert!(v["next_reset_at"].as_i64().unwrap() > now());
        assert_eq!(v["next_reset_at"].as_i64().unwrap() % 86400, 0);
    }
}
