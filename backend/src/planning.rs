//! Provider-independent V2 orchestration. It performs no network requests on its own.
//! Production model adapters must implement every stage; deterministic mocks test
//! ordering/invariants, not semantic understanding, image quality or real safety.
use crate::engine::{Candidate, EngineRequest, SafetyReview, StoryMemory};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Stage {
    InputSafety,
    RealityParser,
    PossibilityMiner,
    SeedFactory,
    DiversityFilter,
    TasteJudge,
    CandidateExpander,
    PairwiseTournament,
    VisualDirector,
    MediaGeneration,
    FinalJudge,
    OutputSafety,
    Draft,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reality {
    pub literal_scene: String,
    pub subjects: Vec<String>,
    pub anchors: Vec<String>,
    pub must_not_infer: Vec<String>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Axis {
    Power,
    Rules,
    Agency,
    World,
    Desire,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Possibility {
    pub axis: Axis,
    pub tension: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Seed {
    pub id: String,
    pub axis: Axis,
    pub event_core: String,
    pub genes: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualPlan {
    pub subject: String,
    pub action: String,
    pub setting: String,
    pub preserve: Vec<String>,
    pub avoid: Vec<String>,
}
#[derive(Debug, Clone)]
pub struct Media {
    /// None explicitly means concept-only, never a generated picture.
    pub image_bytes: Option<Vec<u8>>,
    pub model: String,
    pub cost_microunits: u64,
}
#[derive(Debug, Clone)]
pub struct PlannedDraft {
    pub selected: Candidate,
    pub media: Media,
    pub memory: StoryMemory,
    pub review: SafetyReview,
    pub trace: Vec<Stage>,
    /// Planning approval is not independent export moderation.
    pub export_hold: bool,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanningError {
    pub stage: Stage,
    pub code: &'static str,
}
fn failed(stage: Stage, code: &'static str) -> PlanningError {
    PlanningError { stage, code }
}
type Result<T> = std::result::Result<T, PlanningError>;

/// The adapter owns real semantic/model evaluation; browser requests cannot
/// provide trusted reviews or scores. Never implement this with fabricated
/// "passes" for a live provider. Cancellation should wrap each awaited call.
#[allow(async_fn_in_trait)]
pub trait PlanningModel {
    async fn input_safety(&self, request: &EngineRequest) -> Result<bool>;
    async fn parse(&self, request: &EngineRequest) -> Result<Reality>;
    async fn mine(&self, request: &EngineRequest, reality: &Reality) -> Result<Vec<Possibility>>;
    async fn seeds(
        &self,
        request: &EngineRequest,
        reality: &Reality,
        possibilities: &[Possibility],
    ) -> Result<Vec<Seed>>;
    async fn judge(
        &self,
        request: &EngineRequest,
        reality: &Reality,
        seeds: &[Seed],
    ) -> Result<Vec<Candidate>>;
    async fn expand(
        &self,
        request: &EngineRequest,
        reality: &Reality,
        candidate: &Candidate,
    ) -> Result<Candidate>;
    /// Return exactly one of the compared IDs, not arbitrary generated IDs.
    async fn prefer(
        &self,
        request: &EngineRequest,
        left: &Candidate,
        right: &Candidate,
    ) -> Result<String>;
    async fn direct(
        &self,
        request: &EngineRequest,
        reality: &Reality,
        candidate: &Candidate,
    ) -> Result<VisualPlan>;
    async fn render(&self, request: &EngineRequest, plan: &VisualPlan) -> Result<Media>;
    async fn final_judge(
        &self,
        request: &EngineRequest,
        candidate: &Candidate,
        media: &Media,
    ) -> Result<bool>;
    async fn output_safety(
        &self,
        request: &EngineRequest,
        candidate: &Candidate,
        media: &Media,
    ) -> Result<SafetyReview>;
    async fn update_memory(
        &self,
        request: &EngineRequest,
        reality: &Reality,
        candidate: &Candidate,
    ) -> Result<StoryMemory>;
}
fn normalized(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}
fn contains_all(existing: &[String], preserved: &[String]) -> bool {
    existing.iter().all(|x| preserved.contains(x))
}
fn validate_seeds(seeds: &[Seed], count: u8, prior: Option<&StoryMemory>) -> Result<()> {
    if seeds.len() != count as usize {
        return Err(failed(Stage::SeedFactory, "SEED_COUNT"));
    }
    let mut ids = HashSet::new();
    let mut events = HashSet::new();
    let mut groups = HashMap::<Axis, usize>::new();
    for s in seeds {
        if s.id.len() > 256
            || s.event_core.len() > 2000
            || s.genes.len() > 4
            || s.id.is_empty()
            || s.event_core.trim().is_empty()
            || !ids.insert(&s.id)
            || !events.insert(normalized(&s.event_core))
            || s.genes.is_empty()
            || s.genes.iter().any(|g| {
                !matches!(
                    g.as_str(),
                    "A01"
                        | "A02"
                        | "A03"
                        | "A04"
                        | "A05"
                        | "A06"
                        | "A07"
                        | "A08"
                        | "A09"
                        | "A10"
                        | "A11"
                        | "A12"
                        | "A13"
                        | "A14"
                        | "A15"
                        | "A16"
                )
            })
        {
            return Err(failed(Stage::DiversityFilter, "INVALID_OR_DUPLICATE_SEED"));
        }
        if prior.is_some_and(|m| {
            m.previous_events
                .iter()
                .any(|e| normalized(e) == normalized(&s.event_core))
        }) {
            return Err(failed(Stage::DiversityFilter, "REPEATED_EVENT"));
        }
        *groups.entry(s.axis).or_default() += 1;
    }
    let minimum = if count >= 18 { 3 } else { 2 };
    for axis in [
        Axis::Power,
        Axis::Rules,
        Axis::Agency,
        Axis::World,
        Axis::Desire,
    ] {
        if groups.get(&axis).copied().unwrap_or(0) < minimum {
            return Err(failed(Stage::DiversityFilter, "INSUFFICIENT_DIVERSITY"));
        }
    }
    Ok(())
}
/// Run real stages in sequence. No synthetic countdown and no implicit success.
/// The caller must enforce source authorization and cancellation. Monetary cost
/// caps and complete multi-stage billing remain deployment/provider integration
/// responsibilities; this module does not implement a financial spending cap.
pub async fn plan<M: PlanningModel>(
    model: &M,
    request: &EngineRequest,
    mut observe: impl FnMut(Stage),
) -> Result<PlannedDraft> {
    let mut trace = Vec::new();
    macro_rules! stage {
        ($s:ident) => {{
            let s = Stage::$s;
            trace.push(s);
            observe(s);
        }};
    }
    if !(12..=24).contains(&request.seed_count) || request.request_id.is_empty() {
        return Err(failed(Stage::SeedFactory, "INVALID_REQUEST"));
    }
    stage!(InputSafety);
    if !model.input_safety(request).await? {
        return Err(failed(Stage::InputSafety, "INPUT_REJECTED"));
    }
    stage!(RealityParser);
    let reality = model.parse(request).await?;
    if reality.anchors.is_empty() || reality.subjects.is_empty() {
        return Err(failed(Stage::RealityParser, "MISSING_ANCHORS"));
    }
    if request
        .story_memory
        .as_ref()
        .is_some_and(|m| !contains_all(&m.source_anchors, &reality.anchors))
    {
        return Err(failed(Stage::RealityParser, "ANCHOR_DRIFT"));
    }
    stage!(PossibilityMiner);
    let possibilities = model.mine(request, &reality).await?;
    if possibilities.is_empty() {
        return Err(failed(Stage::PossibilityMiner, "NO_POSSIBILITIES"));
    }
    stage!(SeedFactory);
    let seeds = model.seeds(request, &reality, &possibilities).await?;
    stage!(DiversityFilter);
    validate_seeds(&seeds, request.seed_count, request.story_memory.as_ref())?;
    stage!(TasteJudge);
    let judged = model.judge(request, &reality, &seeds).await?;
    if judged.iter().any(|c| !crate::engine::bounded_candidate(c)) {
        return Err(failed(Stage::TasteJudge, "CANDIDATE_TOO_LARGE"));
    }
    let ids: HashSet<_> = seeds.iter().map(|s| s.id.as_str()).collect();
    let mut returned = HashSet::new();
    if judged.len() != seeds.len()
        || judged
            .iter()
            .any(|c| !ids.contains(c.id.as_str()) || !returned.insert(&c.id))
    {
        return Err(failed(Stage::TasteJudge, "CANDIDATE_BINDING"));
    }
    let shortlist: Vec<Candidate> = crate::engine::rank(&judged)
        .into_iter()
        .map(|(c, _)| c.clone())
        .collect();
    if shortlist.is_empty() {
        return Err(failed(Stage::TasteJudge, "NO_QUALIFIED_CANDIDATE"));
    }
    stage!(CandidateExpander);
    let mut expanded = Vec::new();
    for c in shortlist {
        let e = model.expand(request, &reality, &c).await?;
        if !crate::engine::bounded_candidate(&e) {
            return Err(failed(Stage::CandidateExpander, "CANDIDATE_TOO_LARGE"));
        }
        if e.id != c.id {
            return Err(failed(Stage::CandidateExpander, "CANDIDATE_BINDING"));
        }
        if !e.hook.trim().is_empty()
            && !e.caption.trim().is_empty()
            && !e.payoff.trim().is_empty()
            && !e.next_seed.trim().is_empty()
            && e.score().is_some_and(|s| s >= 78.0)
        {
            expanded.push(e);
        }
    }
    if expanded.is_empty() {
        return Err(failed(Stage::CandidateExpander, "NO_EXPANDED_CANDIDATE"));
    }
    stage!(PairwiseTournament);
    let mut wins = vec![0usize; expanded.len()];
    for i in 0..expanded.len() {
        for j in (i + 1)..expanded.len() {
            let winner = model.prefer(request, &expanded[i], &expanded[j]).await?;
            if winner == expanded[i].id {
                wins[i] += 1
            } else if winner == expanded[j].id {
                wins[j] += 1
            } else {
                return Err(failed(Stage::PairwiseTournament, "INVALID_WINNER"));
            }
        }
    }
    let best = (0..expanded.len())
        .max_by(|&a, &b| {
            wins[a].cmp(&wins[b]).then_with(|| {
                expanded[a]
                    .score()
                    .unwrap()
                    .total_cmp(&expanded[b].score().unwrap())
            })
        })
        .unwrap();
    let selected = expanded.swap_remove(best);
    stage!(VisualDirector);
    let visual = model.direct(request, &reality, &selected).await?;
    if !contains_all(&reality.anchors, &visual.preserve)
        || !contains_all(&reality.must_not_infer, &visual.avoid)
    {
        return Err(failed(Stage::VisualDirector, "VISUAL_CONSTRAINT_DRIFT"));
    }
    stage!(MediaGeneration);
    let media = model.render(request, &visual).await?;
    if media.model.is_empty() {
        return Err(failed(Stage::MediaGeneration, "MISSING_MODEL"));
    }
    stage!(FinalJudge);
    if !model.final_judge(request, &selected, &media).await? {
        return Err(failed(Stage::FinalJudge, "OUTPUT_QUALITY_REJECTED"));
    }
    stage!(OutputSafety);
    let review = model.output_safety(request, &selected, &media).await?;
    if !review.input_passed
        || !review.output_passed
        || !review.ai_label_applied
        || review.review_id.is_empty()
        || review.policy_version != request.safety_policy_version
    {
        return Err(failed(Stage::OutputSafety, "OUTPUT_REJECTED"));
    }
    let mut memory = model.update_memory(request, &reality, &selected).await?;
    if !contains_all(&reality.anchors, &memory.source_anchors)
        || request.story_memory.as_ref().is_some_and(|m| {
            !contains_all(&m.immutable_facts, &memory.immutable_facts)
                || !contains_all(&m.previous_events, &memory.previous_events)
        })
    {
        return Err(failed(Stage::Draft, "MEMORY_DRIFT"));
    }
    let event = seeds
        .iter()
        .find(|s| s.id == selected.id)
        .expect("validated candidate binding")
        .event_core
        .clone();
    for current in [event, selected.hook.clone()] {
        if !memory.previous_events.contains(&current) {
            memory.previous_events.push(current);
        }
    }
    if !crate::engine::bounded_memory(&memory) {
        return Err(failed(Stage::Draft, "MEMORY_TOO_LARGE"));
    }
    stage!(Draft);
    Ok(PlannedDraft {
        selected,
        media,
        memory,
        review,
        trace,
        export_hold: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::Scores;
    struct Mock {
        reject_input: bool,
        repeat: bool,
        reject_output: bool,
    }
    fn request() -> EngineRequest {
        EngineRequest {
            request_id: "fixture".into(),
            action: "MAKE_IT_HAPPEN".into(),
            locale: "en-US".into(),
            text: Some("office plant".into()),
            private_source_reference: None,
            story_memory: None,
            seed_count: 20,
            safety_policy_version: "test-only".into(),
        }
    }
    impl PlanningModel for Mock {
        async fn input_safety(&self, _: &EngineRequest) -> Result<bool> {
            Ok(!self.reject_input)
        }
        async fn parse(&self, _: &EngineRequest) -> Result<Reality> {
            Ok(Reality {
                literal_scene: "synthetic fixture".into(),
                subjects: vec!["plant".into()],
                anchors: vec!["green plant".into()],
                must_not_infer: vec!["owner identity".into()],
            })
        }
        async fn mine(&self, _: &EngineRequest, _: &Reality) -> Result<Vec<Possibility>> {
            Ok(vec![Possibility {
                axis: Axis::Agency,
                tension: "fixture".into(),
            }])
        }
        async fn seeds(
            &self,
            r: &EngineRequest,
            _: &Reality,
            _: &[Possibility],
        ) -> Result<Vec<Seed>> {
            Ok((0..r.seed_count)
                .map(|i| Seed {
                    id: format!("s{i}"),
                    axis: [
                        Axis::Power,
                        Axis::Rules,
                        Axis::Agency,
                        Axis::World,
                        Axis::Desire,
                    ][i as usize % 5],
                    event_core: format!("synthetic event {}", if self.repeat { 0 } else { i }),
                    genes: vec!["A03".into(), "A04".into()],
                })
                .collect())
        }
        async fn judge(
            &self,
            _: &EngineRequest,
            _: &Reality,
            seeds: &[Seed],
        ) -> Result<Vec<Candidate>> {
            Ok(seeds
                .iter()
                .map(|s| Candidate {
                    id: s.id.clone(),
                    genes: s.genes.clone(),
                    hook: s.event_core.clone(),
                    caption: "fixture caption".into(),
                    payoff: "fixture consequence".into(),
                    next_seed: "fixture open loop".into(),
                    scores: Scores {
                        surprise: 4.5,
                        relevance: 4.5,
                        specificity: 4.5,
                        deadpan: 4.5,
                        identity_fantasy: 4.5,
                        visual_impact: 4.5,
                        remixability: 4.5,
                        shareability: 4.5,
                    },
                    penalties: [0.0; 5],
                    safety_passed: true,
                    fidelity_passed: true,
                })
                .collect())
        }
        async fn expand(
            &self,
            request: &EngineRequest,
            _: &Reality,
            c: &Candidate,
        ) -> Result<Candidate> {
            let mut expanded = c.clone();
            if request.text.as_deref() == Some("oversized-expansion") {
                expanded.hook = "x".repeat(1001);
            }
            Ok(expanded)
        }
        async fn prefer(&self, _: &EngineRequest, a: &Candidate, _: &Candidate) -> Result<String> {
            Ok(a.id.clone())
        }
        async fn direct(
            &self,
            _: &EngineRequest,
            r: &Reality,
            _: &Candidate,
        ) -> Result<VisualPlan> {
            Ok(VisualPlan {
                subject: "plant".into(),
                action: "fixture".into(),
                setting: "fixture".into(),
                preserve: r.anchors.clone(),
                avoid: r.must_not_infer.clone(),
            })
        }
        async fn render(&self, _: &EngineRequest, _: &VisualPlan) -> Result<Media> {
            Ok(Media {
                image_bytes: None,
                model: "deterministic-test-not-ai".into(),
                cost_microunits: 0,
            })
        }
        async fn final_judge(&self, _: &EngineRequest, _: &Candidate, _: &Media) -> Result<bool> {
            Ok(true)
        }
        async fn output_safety(
            &self,
            r: &EngineRequest,
            _: &Candidate,
            _: &Media,
        ) -> Result<SafetyReview> {
            Ok(SafetyReview {
                policy_version: r.safety_policy_version.clone(),
                input_passed: true,
                output_passed: !self.reject_output,
                export_passed: false,
                ai_label_applied: true,
                review_id: "test-review-not-real-safety".into(),
            })
        }
        async fn update_memory(
            &self,
            _: &EngineRequest,
            r: &Reality,
            c: &Candidate,
        ) -> Result<StoryMemory> {
            Ok(StoryMemory {
                immutable_facts: vec![],
                source_anchors: r.anchors.clone(),
                previous_events: vec![],
                recent_genes: c.genes.clone(),
                open_loops: vec![c.next_seed.clone()],
            })
        }
    }
    #[tokio::test]
    async fn stages_are_ordered_and_export_stays_held() {
        let mut observed = Vec::new();
        let d = plan(
            &Mock {
                reject_input: false,
                repeat: false,
                reject_output: false,
            },
            &request(),
            |s| observed.push(s),
        )
        .await
        .unwrap();
        assert_eq!(d.trace, observed);
        assert_eq!(d.trace.len(), 13);
        assert_eq!(d.trace.first(), Some(&Stage::InputSafety));
        assert_eq!(d.trace.last(), Some(&Stage::Draft));
        assert!(d.export_hold);
        assert!(d.media.image_bytes.is_none());
        assert_eq!(d.selected.id, "s0");
        assert!(d.memory.previous_events.contains(&d.selected.hook));
    }
    #[tokio::test]
    async fn gates_stop_without_fake_output() {
        for (m, stage) in [
            (
                Mock {
                    reject_input: true,
                    repeat: false,
                    reject_output: false,
                },
                Stage::InputSafety,
            ),
            (
                Mock {
                    reject_input: false,
                    repeat: true,
                    reject_output: false,
                },
                Stage::DiversityFilter,
            ),
            (
                Mock {
                    reject_input: false,
                    repeat: false,
                    reject_output: true,
                },
                Stage::OutputSafety,
            ),
        ] {
            assert_eq!(plan(&m, &request(), |_| {}).await.unwrap_err().stage, stage);
        }
    }
    #[tokio::test]
    async fn parent_anchor_loss_is_rejected() {
        let mut r = request();
        r.story_memory = Some(StoryMemory {
            immutable_facts: vec![],
            source_anchors: vec!["missing original anchor".into()],
            previous_events: vec![],
            recent_genes: vec![],
            open_loops: vec![],
        });
        assert_eq!(
            plan(
                &Mock {
                    reject_input: false,
                    repeat: false,
                    reject_output: false
                },
                &r,
                |_| {}
            )
            .await
            .unwrap_err()
            .code,
            "ANCHOR_DRIFT"
        );
    }
    #[tokio::test]
    async fn oversized_expansion_is_rejected_before_render() {
        let mut r = request();
        r.text = Some("oversized-expansion".into());
        let e = plan(
            &Mock {
                reject_input: false,
                repeat: false,
                reject_output: false,
            },
            &r,
            |_| {},
        )
        .await
        .unwrap_err();
        assert_eq!(e.stage, Stage::CandidateExpander);
        assert_eq!(e.code, "CANDIDATE_TOO_LARGE");
    }
}
