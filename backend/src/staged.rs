//! Optional authenticated per-stage HTTP adapter for the local V2 orchestrator.
use super::*;
use crate::engine::{Candidate, EngineRequest, SafetyReview, StoryMemory};
use crate::planning::{
    self, Media, PlanningError, PlanningModel, Possibility, Reality, Seed, Stage, VisualPlan,
};
use serde::de::DeserializeOwned;
struct StageClient<'a> {
    provider: &'a HttpProvider,
    app: &'a App,
    key: &'a str,
    source: Value,
}
fn failure(stage: Stage, code: &'static str) -> PlanningError {
    PlanningError { stage, code }
}
fn stage_name(stage: Stage) -> &'static str {
    match stage {
        Stage::InputSafety => "INPUT_SAFETY",
        Stage::RealityParser => "REALITY_PARSER",
        Stage::PossibilityMiner => "POSSIBILITY_MINER",
        Stage::SeedFactory => "SEED_FACTORY",
        Stage::DiversityFilter => "DIVERSITY_FILTER",
        Stage::TasteJudge => "TASTE_JUDGE",
        Stage::CandidateExpander => "CANDIDATE_EXPANDER",
        Stage::PairwiseTournament => "PAIRWISE_TOURNAMENT",
        Stage::VisualDirector => "VISUAL_DIRECTOR",
        Stage::MediaGeneration => "MEDIA_GENERATION",
        Stage::FinalJudge => "FINAL_JUDGE",
        Stage::OutputSafety => "OUTPUT_SAFETY",
        Stage::Draft => "DRAFT",
    }
}
impl StageClient<'_> {
    fn active(&self, stage: Stage) -> Result<(), PlanningError> {
        let active: bool = self
            .app
            .db
            .lock()
            .unwrap()
            .query_row(
                "SELECT json_extract(data,'$.status')='running' FROM jobs WHERE id=?",
                [self.key],
                |r| r.get(0),
            )
            .map_err(|_| failure(stage, "STORAGE_ERROR"))?;
        if !active {
            return Err(failure(stage, "CANCELLED"));
        }
        Ok(())
    }
    async fn call<T: DeserializeOwned>(
        &self,
        r: &EngineRequest,
        stage: Stage,
        operation: &str,
        payload: Value,
    ) -> Result<T, PlanningError> {
        self.active(stage)?;
        let source = if matches!(
            stage,
            Stage::InputSafety
                | Stage::RealityParser
                | Stage::MediaGeneration
                | Stage::FinalJudge
                | Stage::OutputSafety
        ) {
            self.source.clone()
        } else {
            Value::Null
        };
        let body = json!({"request":r,"stage":stage_name(stage),"operation":operation,"payload":payload,"source_image_base64":source});
        let result = self
            .provider
            .request_json(&body)
            .await
            .map_err(|_| failure(stage, "STAGE_PROVIDER_ERROR"))?;
        self.active(stage)?;
        if result["request_id"] != r.request_id
            || result["stage"] != stage_name(stage)
            || result["operation"] != operation
            || result["demo"] != false
        {
            return Err(failure(stage, "STAGE_RESPONSE_BINDING"));
        }
        serde_json::from_value(result["data"].clone())
            .map_err(|_| failure(stage, "STAGE_RESPONSE_SCHEMA"))
    }
}
fn media_payload(m: &Media) -> Value {
    json!({"model":m.model,"cost_microunits":m.cost_microunits,"image_base64":m.image_bytes.as_ref().map(|b|STANDARD.encode(b))})
}
impl PlanningModel for StageClient<'_> {
    async fn input_safety(&self, r: &EngineRequest) -> Result<bool, PlanningError> {
        self.call(r, Stage::InputSafety, "input_safety", json!({}))
            .await
    }
    async fn parse(&self, r: &EngineRequest) -> Result<Reality, PlanningError> {
        self.call(r, Stage::RealityParser, "parse", json!({})).await
    }
    async fn mine(
        &self,
        r: &EngineRequest,
        reality: &Reality,
    ) -> Result<Vec<Possibility>, PlanningError> {
        self.call(
            r,
            Stage::PossibilityMiner,
            "mine",
            json!({"reality":reality}),
        )
        .await
    }
    async fn seeds(
        &self,
        r: &EngineRequest,
        reality: &Reality,
        possibilities: &[Possibility],
    ) -> Result<Vec<Seed>, PlanningError> {
        self.call(
            r,
            Stage::SeedFactory,
            "seeds",
            json!({"reality":reality,"possibilities":possibilities}),
        )
        .await
    }
    async fn judge(
        &self,
        r: &EngineRequest,
        reality: &Reality,
        seeds: &[Seed],
    ) -> Result<Vec<Candidate>, PlanningError> {
        self.call(
            r,
            Stage::TasteJudge,
            "judge",
            json!({"reality":reality,"seeds":seeds}),
        )
        .await
    }
    async fn expand(
        &self,
        r: &EngineRequest,
        reality: &Reality,
        candidate: &Candidate,
    ) -> Result<Candidate, PlanningError> {
        self.call(
            r,
            Stage::CandidateExpander,
            "expand",
            json!({"reality":reality,"candidate":candidate}),
        )
        .await
    }
    async fn prefer(
        &self,
        r: &EngineRequest,
        left: &Candidate,
        right: &Candidate,
    ) -> Result<String, PlanningError> {
        self.call(
            r,
            Stage::PairwiseTournament,
            "prefer",
            json!({"left":left,"right":right}),
        )
        .await
    }
    async fn direct(
        &self,
        r: &EngineRequest,
        reality: &Reality,
        candidate: &Candidate,
    ) -> Result<VisualPlan, PlanningError> {
        self.call(
            r,
            Stage::VisualDirector,
            "direct",
            json!({"reality":reality,"candidate":candidate}),
        )
        .await
    }
    async fn render(&self, r: &EngineRequest, plan: &VisualPlan) -> Result<Media, PlanningError> {
        let value: Value = self
            .call(r, Stage::MediaGeneration, "render", json!({"plan":plan}))
            .await?;
        let model = field(&value, "model");
        let cost = value["cost_microunits"]
            .as_u64()
            .ok_or(failure(Stage::MediaGeneration, "INVALID_MEDIA_SCHEMA"))?;
        if model.trim().is_empty()
            || value
                .get("image_url")
                .is_some_and(|v| v.as_str() != Some(""))
        {
            return Err(failure(Stage::MediaGeneration, "INVALID_MEDIA_SCHEMA"));
        }
        let image = if let Some(v) = value.get("image_base64") {
            if v.is_null() {
                None
            } else {
                let encoded = v
                    .as_str()
                    .ok_or(failure(Stage::MediaGeneration, "INVALID_IMAGE"))?;
                let raw = STANDARD
                    .decode(encoded)
                    .map_err(|_| failure(Stage::MediaGeneration, "INVALID_IMAGE"))?;
                let permit = self
                    .app
                    .cpu_slots
                    .clone()
                    .try_acquire_owned()
                    .map_err(|_| failure(Stage::MediaGeneration, "IMAGE_BUSY"))?;
                let normalized = tokio::task::spawn_blocking(move || {
                    let _permit = permit;
                    normalize_upload(&raw)
                })
                .await
                .map_err(|_| failure(Stage::MediaGeneration, "IMAGE_WORKER_ERROR"))?
                .map_err(|_| failure(Stage::MediaGeneration, "INVALID_IMAGE"))?;
                Some(normalized)
            }
        } else {
            None
        };
        Ok(Media {
            image_bytes: image,
            model: model.into(),
            cost_microunits: cost,
        })
    }
    async fn final_judge(
        &self,
        r: &EngineRequest,
        candidate: &Candidate,
        media: &Media,
    ) -> Result<bool, PlanningError> {
        self.call(
            r,
            Stage::FinalJudge,
            "final_judge",
            json!({"candidate":candidate,"media":media_payload(media)}),
        )
        .await
    }
    async fn output_safety(
        &self,
        r: &EngineRequest,
        candidate: &Candidate,
        media: &Media,
    ) -> Result<SafetyReview, PlanningError> {
        self.call(
            r,
            Stage::OutputSafety,
            "output_safety",
            json!({"candidate":candidate,"media":media_payload(media)}),
        )
        .await
    }
    async fn update_memory(
        &self,
        r: &EngineRequest,
        reality: &Reality,
        candidate: &Candidate,
    ) -> Result<StoryMemory, PlanningError> {
        self.call(
            r,
            Stage::Draft,
            "update_memory",
            json!({"reality":reality,"candidate":candidate}),
        )
        .await
    }
}
pub(super) async fn generate(
    provider: &HttpProvider,
    app: &App,
    key: &str,
    body: Value,
) -> Result<(engine::EngineResponse, Option<Vec<u8>>), String> {
    let request: EngineRequest =
        serde_json::from_value(body["request"].clone()).map_err(|_| "INVALID_ENGINE_REQUEST")?;
    let client = StageClient {
        provider,
        app,
        key,
        source: body["source_image_base64"].clone(),
    };
    let work = planning::plan(&client, &request, |stage| {
        let _=app.db.lock().unwrap().execute("UPDATE jobs SET data=json_set(data,'$.stage',?) WHERE id=? AND json_extract(data,'$.status')='running'",params![stage_name(stage),key]);
    });
    let draft = tokio::time::timeout(std::time::Duration::from_secs(240), work)
        .await
        .map_err(|_| "PIPELINE_TIMEOUT")?
        .map_err(|e| format!("{}:{}", stage_name(e.stage), e.code))?;
    let trace: Vec<&str> = draft.trace.iter().map(|stage| stage_name(*stage)).collect();
    app.db.lock().unwrap().execute("UPDATE jobs SET data=json_set(data,'$.stage_trace',json(?)) WHERE id=? AND json_extract(data,'$.status')='running'",params![json!(trace).to_string(),key]).map_err(|_|"STORAGE_ERROR")?;
    let image = draft.media.image_bytes;
    let out = engine::EngineResponse {
        request_id: request.request_id,
        model: draft.media.model,
        candidates: vec![draft.selected.clone()],
        selected_candidate_id: draft.selected.id,
        updated_story_memory: draft.memory,
        image_url: String::new(),
        review: draft.review,
        cost_microunits: draft.media.cost_microunits,
        currency: "UNSPECIFIED".into(),
    };
    Ok((out, image))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn candidate(seed: &Value) -> Value {
        json!({"id":seed["id"],"genes":seed["genes"],"hook":seed["event_core"],"caption":"Specific fixture consequence","payoff":"A precise fixture action","next_seed":"Who approves the fixture?","scores":{"surprise":4.5,"relevance":4.5,"specificity":4.5,"deadpan":4.5,"identity_fantasy":4.5,"visual_impact":4.5,"remixability":4.5,"shareability":4.5},"penalties":[0,0,0,0,0],"safety_passed":true,"fidelity_passed":true})
    }
    async fn mock(h: HeaderMap, Json(v): Json<Value>) -> Json<Value> {
        assert_eq!(h[header::AUTHORIZATION], "Bearer staged-test-only");
        let r = &v["request"];
        let p = &v["payload"];
        let text = field(r, "text");
        let op = field(&v, "operation");
        if op == "parse" && text == "cancel" {
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
        let data=match op{
"input_safety"=>json!(text!="deny"),"parse"=>json!({"literal_scene":"fixture plant","subjects":["plant"],"anchors":["green plant"],"must_not_infer":["identity"]}),"mine"=>json!([{"axis":"Agency","tension":"fixture"}]),"seeds"=>json!((0..r["seed_count"].as_u64().unwrap()).map(|i|json!({"id":format!("s{i}"),"axis":(["Power","Rules","Agency","World","Desire"][i as usize%5]),"event_core":format!("fixture event {i}"),"genes":["A03","A04"]})).collect::<Vec<_>>()),"judge"=>json!(p["seeds"].as_array().unwrap().iter().map(candidate).collect::<Vec<_>>()),"expand"=>p["candidate"].clone(),"prefer"=>p["left"]["id"].clone(),"direct"=>json!({"subject":"plant","action":"fixture","setting":"fixture","preserve":["green plant"],"avoid":["identity"]}),"render"=>json!({"model":"staged-local-mock-not-ai","cost_microunits":0,"image_base64":null}),"final_judge"=>json!(true),"output_safety"=>json!({"policy_version":"20261020","input_passed":true,"output_passed":true,"export_passed":false,"ai_label_applied":true,"review_id":"fixture-only"}),"update_memory"=>json!({"immutable_facts":[],"source_anchors":["green plant"],"previous_events":[p["candidate"]["hook"]],"recent_genes":["A03"],"open_loops":["fixture"]}),_=>panic!("unexpected operation")};
        Json(
            json!({"request_id":if text=="wrong"{json!("mismatched")}else{r["request_id"].clone()},"stage":v["stage"],"operation":op,"demo":false,"data":data}),
        )
    }
    fn seed_job(a: &App, key: &str, text: &str) -> Value {
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
        v
    }
    #[tokio::test]
    async fn staged_http_pipeline_binding_and_cancellation() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, Router::new().route("/stages", post(mock)))
                .await
                .unwrap()
        });
        let mut a = init(Connection::open_in_memory().unwrap(), false);
        a.provider = Some(HttpProvider {
            url: format!("http://{addr}/stages"),
            key: "staged-test-only".into(),
            seed_count: 20,
            staged: true,
            client: reqwest::Client::new(),
        });
        a.db.lock()
            .unwrap()
            .execute(
                "INSERT INTO users VALUES('u','u@staged.test','test-only',?)",
                [json!({"default_remix_allowed":true}).to_string()],
            )
            .unwrap();
        for (key, text) in [("good", "cat"), ("denied", "deny"), ("wrong", "wrong")] {
            let v = seed_job(&a, key, text);
            run(a.clone(), key.into(), "u".into(), v).await;
        }
        let good = owned(&a, "jobs", "good", "u").unwrap();
        assert_eq!(good["status"], "succeeded");
        assert_eq!(good["stage_trace"].as_array().unwrap().len(), 13);
        assert_eq!(good["stage_trace"][0], "INPUT_SAFETY");
        assert_eq!(
            owned(&a, "jobs", "denied", "u").unwrap()["status"],
            "failed"
        );
        assert!(owned(&a, "jobs", "wrong", "u").unwrap()["error"]["code"]
            .as_str()
            .unwrap()
            .contains("STAGE_RESPONSE_BINDING"));
        let v = seed_job(&a, "cancel", "cancel");
        let aa = a.clone();
        let work = tokio::spawn(async move {
            run(aa, "cancel".into(), "u".into(), v).await;
        });
        tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        a.db.lock()
            .unwrap()
            .execute(
                "UPDATE jobs SET data=json_set(data,'$.status','cancelled') WHERE id='cancel'",
                [],
            )
            .unwrap();
        work.await.unwrap();
        assert_eq!(
            owned(&a, "jobs", "cancel", "u").unwrap()["status"],
            "cancelled"
        );
        assert_eq!(list(&a, "u").unwrap().len(), 1);
        server.abort();
    }
}
