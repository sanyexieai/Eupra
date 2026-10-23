//! Provider-neutral V2 planning contract. No template output is represented as model output.
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryMemory {
    pub immutable_facts: Vec<String>,
    pub open_loops: Vec<String>,
    pub recent_genes: Vec<String>,
    pub source_anchors: Vec<String>,
    pub previous_events: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineRequest {
    pub request_id: String,
    pub action: String,
    pub locale: String,
    pub text: Option<String>,
    pub private_source_reference: Option<String>,
    pub story_memory: Option<StoryMemory>,
    pub seed_count: u8,
    pub safety_policy_version: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scores {
    pub surprise: f64,
    pub relevance: f64,
    pub specificity: f64,
    pub deadpan: f64,
    pub identity_fantasy: f64,
    pub visual_impact: f64,
    pub remixability: f64,
    pub shareability: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub id: String,
    pub genes: Vec<String>,
    pub hook: String,
    pub caption: String,
    pub payoff: String,
    pub next_seed: String,
    pub scores: Scores,
    pub penalties: [f64; 5],
    pub safety_passed: bool,
    pub fidelity_passed: bool,
}
impl Candidate {
    pub fn score(&self) -> Option<f64> {
        let s = &self.scores;
        let scores = [
            s.surprise,
            s.relevance,
            s.specificity,
            s.deadpan,
            s.identity_fantasy,
            s.visual_impact,
            s.remixability,
            s.shareability,
        ];
        if scores
            .iter()
            .any(|v| !v.is_finite() || !(0.0..=5.0).contains(v))
            || self.penalties.iter().any(|v| !v.is_finite() || *v < 0.0)
            || s.relevance < 3.0
            || s.specificity < 3.0
            || s.visual_impact < 2.5
            || !self.safety_passed
            || !self.fidelity_passed
        {
            return None;
        }
        let weights = [0.18, 0.14, 0.14, 0.12, 0.10, 0.10, 0.10, 0.12];
        Some(
            (scores.iter().zip(weights).map(|(s, w)| s * w).sum::<f64>() * 20.0
                - self.penalties.iter().sum::<f64>())
            .clamp(0.0, 100.0),
        )
    }
}
pub fn rank(candidates: &[Candidate]) -> Vec<(&Candidate, f64)> {
    let mut ranked: Vec<_> = candidates
        .iter()
        .filter_map(|c| c.score().filter(|s| *s >= 72.0).map(|s| (c, s)))
        .collect();
    ranked.sort_by(|a, b| b.1.total_cmp(&a.1));
    ranked.truncate(6);
    ranked
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineResponse {
    pub request_id: String,
    pub model: String,
    pub candidates: Vec<Candidate>,
    pub selected_candidate_id: String,
    pub updated_story_memory: StoryMemory,
    pub image_url: String,
    pub review: SafetyReview,
    pub cost_microunits: u64,
    pub currency: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyReview {
    pub policy_version: String,
    pub input_passed: bool,
    pub output_passed: bool,
    pub export_passed: bool,
    pub ai_label_applied: bool,
    pub review_id: String,
}
#[cfg(test)]
mod tests {
    use super::*;
    fn candidate() -> Candidate {
        Candidate {
            id: "x".into(),
            genes: vec!["A03".into()],
            hook: "a".into(),
            caption: "b".into(),
            payoff: "c".into(),
            next_seed: "d".into(),
            scores: Scores {
                surprise: 5.0,
                relevance: 5.0,
                specificity: 5.0,
                deadpan: 5.0,
                identity_fantasy: 5.0,
                visual_impact: 5.0,
                remixability: 5.0,
                shareability: 5.0,
            },
            penalties: [0.0; 5],
            safety_passed: true,
            fidelity_passed: true,
        }
    }
    #[test]
    fn weighted_scoring_and_gates() {
        let mut c = candidate();
        assert!((c.score().unwrap() - 100.0).abs() < 0.001);
        c.scores.relevance = 2.99;
        assert_eq!(c.score(), None);
        c.scores.relevance = 5.0;
        c.safety_passed = false;
        assert_eq!(c.score(), None);
        c.safety_passed = true;
        c.penalties[0] = 30.0;
        assert_eq!(rank(&[c]).len(), 0);
    }
    #[test]
    fn invalid_scores_fail_closed() {
        let mut c = candidate();
        c.scores.surprise = f64::NAN;
        assert_eq!(c.score(), None);
        let mut c = candidate();
        c.penalties[0] = -1.0;
        assert_eq!(c.score(), None);
    }
}
/// Bound persisted model-authored story context; never silently truncate immutable facts.
pub fn bounded_memory(m: &StoryMemory) -> bool {
    let groups = [
        &m.immutable_facts,
        &m.open_loops,
        &m.recent_genes,
        &m.source_anchors,
        &m.previous_events,
    ];
    groups
        .iter()
        .all(|g| g.len() <= 256 && g.iter().all(|s| s.len() <= 4000))
        && groups
            .iter()
            .flat_map(|g| g.iter())
            .map(String::len)
            .sum::<usize>()
            <= 256 * 1024
}
pub fn bounded_candidate(c: &Candidate) -> bool {
    c.id.len() <= 256
        && c.hook.len() <= 1000
        && c.caption.len() <= 10000
        && c.payoff.len() <= 4000
        && c.next_seed.len() <= 2000
        && c.genes.len() <= 4
        && c.genes.iter().all(|g| g.len() <= 8)
}
#[cfg(test)]
mod bounds_tests {
    use super::*;
    #[test]
    fn rejects_oversized_model_text_and_memory() {
        let mut c = Candidate {
            id: "s".into(),
            genes: vec!["A03".into()],
            hook: "h".into(),
            caption: "c".into(),
            payoff: "p".into(),
            next_seed: "n".into(),
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
        };
        assert!(bounded_candidate(&c));
        c.hook = "x".repeat(1001);
        assert!(!bounded_candidate(&c));
        c.hook = "h".into();
        c.caption = "x".repeat(10001);
        assert!(!bounded_candidate(&c));
        let mut m = StoryMemory {
            immutable_facts: vec![],
            open_loops: vec![],
            recent_genes: vec![],
            source_anchors: vec![],
            previous_events: vec![],
        };
        assert!(bounded_memory(&m));
        m.previous_events = vec!["x".repeat(4001)];
        assert!(!bounded_memory(&m));
    }
}
