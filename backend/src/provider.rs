#[path = "staged.rs"]
mod staged;
use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};
#[derive(Clone)]
pub struct HttpProvider {
    url: String,
    key: String,
    seed_count: u8,
    staged: bool,
    client: reqwest::Client,
}
impl HttpProvider {
    pub fn from_env() -> Result<Self, String> {
        let url = std::env::var("EUPRA_ENGINE_URL").map_err(|_| "EUPRA_ENGINE_URL required")?;
        let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid engine URL")?;
        if parsed.scheme() != "https"
            && !(parsed.scheme() == "http"
                && matches!(
                    parsed.host_str(),
                    Some("127.0.0.1") | Some("localhost") | Some("::1")
                ))
        {
            return Err("Engine requires HTTPS (loopback HTTP allowed for tests)".into());
        }
        if !parsed.username().is_empty() || parsed.password().is_some() {
            return Err("Do not put credentials in engine URL".into());
        }
        let key = std::env::var("EUPRA_ENGINE_KEY").map_err(|_| "EUPRA_ENGINE_KEY required")?;
        if key.is_empty() {
            return Err("Empty engine key".into());
        }
        let seed_count = std::env::var("EUPRA_SEED_COUNT")
            .unwrap_or("20".into())
            .parse::<u8>()
            .map_err(|_| "Invalid seed count")?;
        if !(18..=24).contains(&seed_count) {
            return Err("Seed count must be 18–24".into());
        }
        let mode = std::env::var("EUPRA_ENGINE_MODE").unwrap_or("complete".into());
        if mode != "complete" && mode != "staged" {
            return Err("EUPRA_ENGINE_MODE must be complete or staged".into());
        }
        Ok(Self {
            staged: mode == "staged",
            seed_count,
            url,
            key,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(90))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|e| e.to_string())?,
        })
    }
    async fn request_json(&self, body: &Value) -> Result<Value, String> {
        let mut r = self
            .client
            .post(&self.url)
            .bearer_auth(&self.key)
            .json(body)
            .send()
            .await
            .map_err(|_| "PROVIDER_REQUEST_FAILED")?;
        if !r.status().is_success() {
            return Err("PROVIDER_REJECTED".into());
        }
        if r.content_length().is_some_and(|n| n > 16 * 1024 * 1024) {
            return Err("PROVIDER_RESPONSE_TOO_LARGE".into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = r.chunk().await.map_err(|_| "PROVIDER_RESPONSE_FAILED")? {
            if bytes.len() + chunk.len() > 16 * 1024 * 1024 {
                return Err("PROVIDER_RESPONSE_TOO_LARGE".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        let value: Value =
            serde_json::from_slice(&bytes).map_err(|_| "INVALID_PROVIDER_RESPONSE")?;
        Ok(value)
    }
    async fn generate(
        &self,
        body: Value,
    ) -> Result<(engine::EngineResponse, Option<Vec<u8>>), String> {
        let value = self.request_json(&body).await?;
        let output: engine::EngineResponse =
            serde_json::from_value(value.clone()).map_err(|_| "INVALID_PROVIDER_SCHEMA")?;
        if value["demo"] != false
            || output.request_id != field(&body["request"], "request_id")
            || output.model.trim().is_empty()
            || output.review.policy_version != "20261020"
            || !output.review.input_passed
            || !output.review.output_passed
            || output.review.review_id.trim().is_empty()
        {
            return Err("SAFETY_OUTPUT_HOLD".into());
        }
        let selected = output
            .candidates
            .iter()
            .find(|c| c.id == output.selected_candidate_id)
            .ok_or("MISSING_SELECTED_CANDIDATE")?;
        if !engine::bounded_candidate(selected)
            || !engine::bounded_memory(&output.updated_story_memory)
            || selected.score().is_none_or(|s| s < 78.0)
            || selected.hook.trim().is_empty()
            || selected.caption.trim().is_empty()
            || selected.hook.len() > 1000
            || selected.caption.len() > 10000
        {
            return Err("QUALITY_GATE_REJECTED".into());
        }
        if let Some(parent) = body["request"]["story_memory"]["immutable_facts"].as_array() {
            for fact in parent {
                if !output
                    .updated_story_memory
                    .immutable_facts
                    .iter()
                    .any(|f| Some(f.as_str()) == fact.as_str())
                {
                    return Err("STORY_MEMORY_DRIFT".into());
                }
            }
        }
        if value
            .get("image_base64")
            .is_some_and(|v| !v.is_null() && !v.is_string())
        {
            return Err("INVALID_PROVIDER_IMAGE".into());
        }
        let image = if let Some(encoded) = value["image_base64"].as_str() {
            let raw = STANDARD
                .decode(encoded)
                .map_err(|_| "INVALID_PROVIDER_IMAGE")?;
            let mut reader = image::ImageReader::new(Cursor::new(&raw))
                .with_guessed_format()
                .map_err(|_| "INVALID_PROVIDER_IMAGE")?;
            let mut limits = image::Limits::default();
            limits.max_image_width = Some(4096);
            limits.max_image_height = Some(4096);
            limits.max_alloc = Some(96 * 1024 * 1024);
            reader.limits(limits);
            let img = reader.decode().map_err(|_| "INVALID_PROVIDER_IMAGE")?;
            let mut out = Cursor::new(Vec::new());
            img.write_to(&mut out, image::ImageFormat::Png)
                .map_err(|_| "INVALID_PROVIDER_IMAGE")?;
            let normalized = out.into_inner();
            if normalized.len() > 20 * 1024 * 1024 {
                return Err("PROVIDER_IMAGE_TOO_LARGE".into());
            }
            Some(normalized)
        } else {
            None
        };
        if !output.image_url.is_empty() {
            return Err("REMOTE_IMAGE_URL_UNSUPPORTED".into());
        }
        Ok((output, image))
    }
}
pub async fn run(a: App, key: String, uid: String, v: Value) {
    let result = process(&a, &key, &uid, &v).await;
    if let Err(code) = result {
        let db = a.db.lock().unwrap();
        let _:Result<usize,_>=db.execute("UPDATE jobs SET data=json_set(data,'$.status','failed','$.stage','FAILED','$.error',json(?)) WHERE id=? AND json_extract(data,'$.status') IN ('queued','running')",params![json!({"code":code,"message":"Generation could not be safely completed"}).to_string(),key]);
    }
}
async fn process(a: &App, key: &str, uid: &str, v: &Value) -> Result<(), String> {
    let parent = field(v, "parent_version_id");
    let p = if parent.is_empty() {
        None
    } else {
        Some(owned(a, "versions", parent, uid).map_err(|_| "PARENT_UNAVAILABLE")?)
    };
    let source_id = if field(v, "source_id").is_empty() {
        p.as_ref().map(|p| field(p, "source_id")).unwrap_or("")
    } else {
        field(v, "source_id")
    };
    let source: Option<Vec<u8>> = if source_id.is_empty() {
        None
    } else {
        a.db.lock()
            .unwrap()
            .query_row(
                "SELECT bytes FROM uploads WHERE id=? AND user_id=?",
                params![source_id, uid],
                |r| r.get(0),
            )
            .optional()
            .map_err(|_| "STORAGE_ERROR")?
    };
    let request = json!({"request_id":key,"action":if parent.is_empty(){"MAKE_IT_HAPPEN"}else{"PUSH_FURTHER"},"locale":v.get("locale").and_then(Value::as_str).unwrap_or("zh-CN"),"text":v.get("text"),"private_source_reference":null,"story_memory":p.as_ref().map(|p|p["story_memory"].clone()),"seed_count":a.provider.as_ref().map(|p|p.seed_count).unwrap_or(20),"safety_policy_version":"20261020"});
    {
        let db = a.db.lock().unwrap();
        let changed=db.execute("UPDATE jobs SET data=json_set(data,'$.status','running','$.stage','PROVIDER_PIPELINE') WHERE id=? AND json_extract(data,'$.status')='queued'",[key]).map_err(|_|"STORAGE_ERROR")?;
        if changed == 0 {
            return Ok(());
        }
    }
    let provider = a.provider.as_ref().ok_or("PROVIDER_UNAVAILABLE")?;
    let body = json!({"request":request,"source_image_base64":source.map(|b|STANDARD.encode(b))});
    let (out, image) = if provider.staged {
        staged::generate(provider, a, key, body).await?
    } else {
        provider.generate(body).await?
    };
    let mut db = a.db.lock().unwrap();
    let tx = db.transaction().map_err(|_| "STORAGE_ERROR")?;
    let status: String = tx
        .query_row(
            "SELECT json_extract(data,'$.status') FROM jobs WHERE id=?",
            [key],
            |r| r.get(0),
        )
        .map_err(|_| "STORAGE_ERROR")?;
    if status == "cancelled" {
        return Ok(());
    }
    if !parent.is_empty() {
        let permitted:bool=tx.query_row("SELECT json_extract(data,'$.remix_allowed') FROM versions WHERE id=? AND user_id=?",params![parent,uid],|r|r.get(0)).map_err(|_|"PARENT_UNAVAILABLE")?;
        if !permitted {
            return Err("REMIX_DISABLED".into());
        }
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
    let image_url = if let Some(bytes) = image {
        let image_id = id();
        tx.execute(
            "INSERT INTO uploads VALUES(?,?,?,?)",
            params![image_id, uid, "image/png", bytes],
        )
        .map_err(|_| "STORAGE_ERROR")?;
        Some(format!("/api/v1/uploads/{image_id}"))
    } else {
        None
    };
    let c = out
        .candidates
        .iter()
        .find(|c| c.id == out.selected_candidate_id)
        .ok_or("MISSING_SELECTED_CANDIDATE")?;
    let settings: String = tx
        .query_row("SELECT settings FROM users WHERE id=?", [uid], |r| r.get(0))
        .map_err(|_| "STORAGE_ERROR")?;
    let settings: Value = serde_json::from_str(&settings).map_err(|_| "STORAGE_ERROR")?;
    let version = json!({"id":vid,"root_version_id":root,"parent_version_id":if parent.is_empty(){Value::Null}else{json!(parent)},"story_world_id":world,"creator_id":uid,"title":c.hook,"caption":c.caption,"image_url":image_url,"source_id":if source_id.is_empty(){Value::Null}else{json!(source_id)},"favorite":false,"kind":field(v,"kind"),"depth":p.as_ref().and_then(|p|p["depth"].as_u64()).map(|d|d+1).unwrap_or(0),"remix_allowed":settings["default_remix_allowed"],"safety_state":"HOLD","demo":false,"created_at":now(),"story_memory":out.updated_story_memory,"engine":{"provider":"http","model":out.model,"quality_score":c.score(),"review":out.review,"cost_microunits":out.cost_microunits,"currency":out.currency,"output_type":if image_url.is_some(){"image"}else{"concept_only"},"export_status":"HOLD_PENDING_INDEPENDENT_REVIEW"}});
    tx.execute(
        "INSERT INTO versions VALUES(?,?,?,?)",
        params![vid, uid, world, version.to_string()],
    )
    .map_err(|_| "STORAGE_ERROR")?;
    tx.execute("UPDATE jobs SET data=json_set(data,'$.status','succeeded','$.stage','DRAFT','$.version_id',?) WHERE id=?",params![vid,key]).map_err(|_|"STORAGE_ERROR")?;
    sharing::contribution(&tx, &vid, &root, p.as_ref(), uid).map_err(|_| "STORAGE_ERROR")?;
    tx.commit().map_err(|_| "STORAGE_ERROR")?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    async fn mock(h: HeaderMap, Json(v): Json<Value>) -> Json<Value> {
        assert_eq!(
            h.get(header::AUTHORIZATION).unwrap(),
            "Bearer local-test-only"
        );
        assert_eq!(v["request"]["seed_count"], 20);
        let denied = v["request"]["text"] == "deny";
        Json(
            json!({"request_id":v["request"]["request_id"],"demo":false,"model":"local-test-engine","candidates":[{"id":"best","genes":["A03","A04"],"hook":"A specific reversal","caption":"The meeting room now requires the manager to book leave.","payoff":"The room controls attendance.","next_seed":"Who approves the room?","scores":{"surprise":4.5,"relevance":4.5,"specificity":4.5,"deadpan":4.5,"identity_fantasy":4.5,"visual_impact":4.5,"remixability":4.5,"shareability":4.5},"penalties":[0,0,0,0,0],"safety_passed":true,"fidelity_passed":true}],"selected_candidate_id":"best","updated_story_memory":{"immutable_facts":["room controls attendance"],"open_loops":["who approves room"],"recent_genes":["A03"],"source_anchors":[],"previous_events":[]},"image_url":"","review":{"policy_version":"20261020","input_passed":true,"output_passed":!denied,"export_passed":false,"ai_label_applied":false,"review_id":"local-test-review"},"cost_microunits":0,"currency":"USD"}),
        )
    }
    #[tokio::test]
    async fn http_wire_contract_and_fail_closed_safety() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            axum::serve(listener, Router::new().route("/engine", post(mock)))
                .await
                .unwrap()
        });
        let provider = HttpProvider {
            url: format!("http://{addr}/engine"),
            key: "local-test-only".into(),
            seed_count: 20,
            staged: false,
            client: reqwest::Client::new(),
        };
        let good = provider
            .generate(json!({"request":{"request_id":"test-id","text":"cat","seed_count":20}}))
            .await
            .unwrap();
        assert_eq!(good.0.model, "local-test-engine");
        assert!(good.1.is_none());
        let bad = provider
            .generate(json!({"request":{"request_id":"test-id","text":"deny","seed_count":20}}))
            .await;
        assert_eq!(bad.unwrap_err(), "SAFETY_OUTPUT_HOLD");
        task.abort();
    }
    #[tokio::test]
    async fn http_job_persists_only_reviewed_private_version() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            axum::serve(listener, Router::new().route("/engine", post(mock)))
                .await
                .unwrap()
        });
        let mut a = init(Connection::open_in_memory().unwrap(), false);
        a.provider = Some(HttpProvider {
            url: format!("http://{addr}/engine"),
            key: "local-test-only".into(),
            seed_count: 20,
            staged: false,
            client: reqwest::Client::new(),
        });
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO users VALUES('u','u@example.test','test-only',?)",
                [json!({"default_remix_allowed":false}).to_string()],
            )
            .unwrap();
        for (key, text) in [("good", "cat"), ("bad", "deny")] {
            let v = json!({"kind":"first_twist","text":text});
            a.db.lock()
                .unwrap()
                .execute(
                    "INSERT INTO jobs VALUES(?,?,?,?,?)",
                    params![
                        key,
                        "u",
                        key,
                        v.to_string(),
                        json!({"id":key,"status":"queued"}).to_string()
                    ],
                )
                .unwrap();
            run(a.clone(), key.into(), "u".into(), v).await;
        }
        let good = owned(&a, "jobs", "good", "u").unwrap();
        assert_eq!(good["status"], "succeeded");
        let version = owned(&a, "versions", good["version_id"].as_str().unwrap(), "u").unwrap();
        assert_eq!(version["demo"], false);
        assert_eq!(version["safety_state"], "HOLD");
        assert_eq!(version["remix_allowed"], false);
        assert_eq!(version["engine"]["output_type"], "concept_only");
        assert_eq!(owned(&a, "jobs", "bad", "u").unwrap()["status"], "failed");
        assert_eq!(list(&a, "u").unwrap().len(), 1);
        task.abort();
    }
}
