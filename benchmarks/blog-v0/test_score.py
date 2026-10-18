import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('blog_score', HERE / 'score.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ScoreTests(unittest.TestCase):
    def setUp(self):
        self.rubric = json.loads((HERE / 'rubric.json').read_text())
        self.review = {'gates': {name: True for name in self.rubric['gates']},
                       'items': {item['id']: {'pass': True, 'evidence': 'reviewed artifact'} for item in self.rubric['items']}}

    def test_failure_cannot_be_hidden_by_quality_points(self):
        self.review['gates'][self.rubric['gates'][0]] = False
        result = MODULE.score(self.rubric, self.review)
        self.assertEqual(result['status'], 'failed')
        self.assertIsNone(result['qualityScore'])

    def test_unreviewed_is_not_a_pass_or_a_final_score(self):
        self.review['items']['settled']['pass'] = None
        result = MODULE.score(self.rubric, self.review)
        self.assertEqual(result['status'], 'needs-review')
        self.assertIsNone(result['qualityScore'])
        self.assertIn('settled', result['pendingItems'])
        self.assertIsNone(result['dimensions']['clarity'])

    def test_quality_uses_fixed_denominator(self):
        self.review['items']['portable']['pass'] = False
        self.assertEqual(MODULE.score(self.rubric, self.review)['qualityScore'], 95)

    def test_missing_item_refused(self):
        del self.review['items']['portable']
        with self.assertRaises(ValueError):
            MODULE.score(self.rubric, self.review)

    def test_blocked_workflow_does_not_invent_artifact_quality(self):
        self.review['blockedReason'] = 'No passed capture'
        for item in self.review['items'].values():
            item['pass'] = None
            item['evidence'] = 'Not exercised: capture blocked before first step'
        result = MODULE.score(self.rubric, self.review)
        self.assertEqual(result['status'], 'blocked')
        self.assertIsNone(result['qualityScore'])


if __name__ == '__main__':
    unittest.main()
