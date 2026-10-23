//! A private projection of this version's submitted job input, never ancestor inputs.
use super::*;
fn unavailable() -> ErrApi {
    err(
        StatusCode::NOT_FOUND,
        "SOURCE_UNAVAILABLE",
        "Original input is unavailable",
    )
}
pub async fn read(State(a): State<App>, h: HeaderMap, Path(key): Path<String>) -> R<Response> {
    let uid = user(&a, &h)?;
    let db = a.db.lock().unwrap();
    let raw: Option<String> = db.query_row("SELECT v.data FROM versions v LEFT JOIN work_states w ON w.version_id=v.id WHERE v.id=? AND v.user_id=? AND w.deleted_at IS NULL", params![key, uid], |r|r.get(0)).optional()?;
    let version: Value = serde_json::from_str(
        &raw.ok_or_else(|| err(StatusCode::NOT_FOUND, "NOT_FOUND", "Version not found"))?,
    )
    .map_err(|_| unavailable())?;
    let mut query=db.prepare("SELECT request FROM jobs WHERE user_id=? AND CASE WHEN json_valid(data) THEN json_extract(data,'$.status')='succeeded' AND json_extract(data,'$.version_id')=? ELSE 0 END LIMIT 2")?;
    let requests = query
        .query_map(params![uid, key], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    if requests.len() != 1 {
        return Err(unavailable());
    }
    let request: Value = serde_json::from_str(&requests[0]).map_err(|_| unavailable())?;
    if !request.is_object()
        || !matches!(field(&request, "kind"), "first_twist" | "continuation")
        || request["kind"] != version["kind"]
        || field(&request, "parent_version_id") != field(&version, "parent_version_id")
    {
        return Err(unavailable());
    }
    let text = match request.get("text") {
        None => "",
        Some(Value::String(s)) => s.as_str(),
        _ => return Err(unavailable()),
    };
    let source = match request.get("source_id") {
        None | Some(Value::Null) => "",
        Some(Value::String(s)) => s.as_str(),
        _ => return Err(unavailable()),
    };
    if !source.is_empty() {
        let exists: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM uploads WHERE id=? AND user_id=?)",
            params![source, uid],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(unavailable());
        }
    }
    let body = json!({"version_id":key,"kind":request["kind"],"text":text,"source_id":if source.is_empty(){Value::Null}else{json!(source)},"source_url":if source.is_empty(){Value::Null}else{json!(format!("/api/v1/uploads/{source}"))},"parent_version_id":if field(&request,"parent_version_id").is_empty(){Value::Null}else{json!(field(&request,"parent_version_id"))},"scope":"own_generation_input"});
    Ok((
        [
            (header::CACHE_CONTROL, "private, no-store"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
            (header::REFERRER_POLICY, "no-referrer"),
        ],
        Json(body),
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::{account, request};
    async fn generate(app: &Router, cookie: &str, body: Value, key: &str) -> (String, String) {
        let (s, j, _) = request(app, "POST", "/api/v1/generation-jobs", cookie, body, key).await;
        assert_eq!(s, 200);
        let id = j["id"].as_str().unwrap().to_string();
        for _ in 0..100 {
            let (_, job, _) = request(
                app,
                "GET",
                &format!("/api/v1/generation-jobs/{id}"),
                cookie,
                Value::Null,
                "",
            )
            .await;
            if job["status"] == "succeeded" {
                return (id, job["version_id"].as_str().unwrap().into());
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        panic!("generation did not complete")
    }
    #[tokio::test]
    async fn source_exact_input_ownership_and_missing_provenance_fail_closed() {
        let a = init(Connection::open_in_memory().unwrap(), true);
        let app = routes(a.clone());
        let alice = account(&app, "source-a@local.test").await;
        let bob = account(&app, "source-b@local.test").await;
        let (_, m, _) = request(&app, "GET", "/api/v1/auth/me", &alice, Value::Null, "").await;
        let uid = m["user"]["id"].as_str().unwrap();
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO uploads VALUES('own-source',?,'image/png',?)",
                params![uid, vec![1u8]],
            )
            .unwrap();
        let full = "原始输入".repeat(100);
        let (jid, vid) = generate(
            &app,
            &alice,
            json!({"kind":"first_twist","text":full,"source_id":"own-source"}),
            "source-first",
        )
        .await;
        let path = format!("/api/v1/versions/{vid}/source");
        let (s, v, _) = request(&app, "GET", &path, &alice, Value::Null, "").await;
        assert_eq!(s, 200);
        assert_eq!(v["text"], full);
        assert_eq!(v["source_url"], "/api/v1/uploads/own-source");
        assert_eq!(v.as_object().unwrap().len(), 7);
        for (c, s) in [(&bob, 404), (&String::new(), 401)] {
            assert_eq!(request(&app, "GET", &path, c, Value::Null, "").await.0, s);
        }
        request(
            &app,
            "DELETE",
            &format!("/api/v1/versions/{vid}"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(
            request(&app, "GET", &path, &alice, Value::Null, "").await.0,
            404
        );
        request(
            &app,
            "POST",
            &format!("/api/v1/versions/{vid}/restore"),
            &alice,
            json!({}),
            "",
        )
        .await;
        a.db.lock()
            .unwrap()
            .execute(
                "UPDATE jobs SET request=json_set(request,'$.source_id','unavailable') WHERE id=?",
                [&jid],
            )
            .unwrap();
        let (s, v, _) = request(&app, "GET", &path, &alice, Value::Null, "").await;
        assert_eq!(s, 404);
        assert_eq!(v["error"]["code"], "SOURCE_UNAVAILABLE");
        a.db.lock()
            .unwrap()
            .execute(
                "UPDATE jobs SET data=json_set(data,'$.status','failed') WHERE id=?",
                [jid],
            )
            .unwrap();
        assert_eq!(
            request(&app, "GET", &path, &alice, Value::Null, "").await.0,
            404
        );
    }
    #[tokio::test]
    async fn source_shared_continuation_never_inherits_ancestor_input_or_tokens() {
        let mut a = init(Connection::open_in_memory().unwrap(), true);
        a.local_review = true;
        let app = routes(a.clone());
        let alice = account(&app, "source-parent@local.test").await;
        let bob = account(&app, "source-child@local.test").await;
        let (_, m, _) = request(&app, "GET", "/api/v1/auth/me", &alice, Value::Null, "").await;
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO uploads VALUES('ANCESTOR_SOURCE',?,'image/png',?)",
                params![m["user"]["id"].as_str().unwrap(), vec![1u8]],
            )
            .unwrap();
        let(_,parent)=generate(&app,&alice,json!({"kind":"first_twist","text":"ANCESTOR_PRIVATE_TEXT","source_id":"ANCESTOR_SOURCE"}),"root-source").await;
        request(
            &app,
            "POST",
            &format!("/api/v1/versions/{parent}/local-review"),
            &alice,
            json!({"approved":true}),
            "",
        )
        .await;
        let (s, link, _) = request(
            &app,
            "POST",
            "/api/v1/share-links",
            &alice,
            json!({"version_id":parent}),
            "",
        )
        .await;
        assert_eq!(s, 200);
        let token = link["token"].as_str().unwrap();
        let(_,child)=generate(&app,&bob,json!({"kind":"continuation","parent_version_id":parent,"share_token":token,"text":"My own continuation"}),"child-source").await;
        let (s, v, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{child}/source"),
            &bob,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["text"], "My own continuation");
        assert!(v["source_id"].is_null());
        assert!(v["source_url"].is_null());
        assert_eq!(v["parent_version_id"], parent);
        let raw = v.to_string();
        for secret in [
            "ANCESTOR_SOURCE",
            "ANCESTOR_PRIVATE_TEXT",
            token,
            "sha256:",
            "story_memory",
        ] {
            assert!(!raw.contains(secret));
        }
        assert_eq!(
            request(
                &app,
                "GET",
                &format!("/api/v1/versions/{parent}/source"),
                &bob,
                Value::Null,
                ""
            )
            .await
            .0,
            404
        );
        let (_, own_child) = generate(
            &app,
            &alice,
            json!({"kind":"continuation","parent_version_id":parent}),
            "own-child-source",
        )
        .await;
        let (s, v, _) = request(
            &app,
            "GET",
            &format!("/api/v1/versions/{own_child}/source"),
            &alice,
            Value::Null,
            "",
        )
        .await;
        assert_eq!(s, 200);
        assert_eq!(v["text"], "");
        assert!(v["source_id"].is_null());
    }
}
