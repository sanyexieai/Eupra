import json
from pathlib import Path
import unittest
from validate import validate
from build_fixtures import build

class FixtureTests(unittest.TestCase):
    def setUp(self):
        self.suite = json.loads(Path(__file__).with_name('cases.json').read_text(encoding='utf-8'))

    def reject(self, mutation):
        mutation(self.suite)
        with self.assertRaises(ValueError):
            validate(self.suite)

    def test_baseline_counts_and_no_quality_claim(self):
        result = validate(self.suite)
        self.assertEqual(result['cases'],100)
        self.assertEqual(result['needs_authorized_real_image'],56)
        self.assertEqual(result['humor_quality'],'not_assessed')
        self.assertEqual(result['provider_execution'],'not_run')

    def test_rubric_is_unscored(self):
        rubric = json.loads(Path(__file__).with_name("rubric.json").read_text())
        self.assertAlmostEqual(sum(rubric["dimensions"].values()),1.0)
        self.assertIsNone(rubric["judgements"])
        self.assertIsNone(rubric["penalty_weights"])
        self.assertEqual(rubric["human_review_status"],"not_run")

    def test_reproducible(self):
        self.assertEqual(build(),self.suite)

    def test_duplicate_id(self):
        self.reject(lambda s: s['cases'][1].update(id=s['cases'][0]['id']))

    def test_missing_anchor(self):
        self.reject(lambda s: s['cases'][0].update(must_preserve=[]))

    def test_wrong_parent_snapshot(self):
        self.reject(lambda s: s['cases'][72]['context']['world_state'].update(current_version_id='newest'))

    def test_collapsed_comment_attribution(self):
        self.reject(lambda s: s['cases'][75]['context']['comment'].update(author_id=s['cases'][75]['context']['creator_id']))

    def test_fabricated_quality(self):
        self.reject(lambda s: s['cases'][0]['evaluation'].update(quality_scores={'humor':5}))

    def test_fabricated_output(self):
        self.reject(lambda s: s['cases'][0]['evaluation'].update(output='pretend output'))

    def test_photo_cannot_be_marked_ready(self):
        self.reject(lambda s: s['cases'][0]['input'].update(source_status='synthetic_text_ready'))

    def test_missing_cases(self):
        self.reject(lambda s: s['cases'].pop())

    def test_coverage(self):
        self.reject(lambda s: s['cases'][0].update(category='objects_office'))

    def test_claimed_human_review(self):
        self.reject(lambda s: s['cases'][0]['evaluation'].update(human_blind_review='passed'))

if __name__ == '__main__':
    unittest.main()
