"""The offline editor and final renderer share the same acceptance examples."""
import json
from pathlib import Path
import unittest
from capture_view import validate_coverage


class ContractTests(unittest.TestCase):
    def test_shared_evidence_examples(self):
        fixture = json.loads((Path(__file__).resolve().parents[1] / 'evals/fixtures/evidence-cases.json').read_text())
        for case in fixture['cases']:
            with self.subTest(case=case['id']):
                try:
                    validate_coverage(case['step'], fixture['viewport'])
                    valid = True
                except (ValueError, KeyError, TypeError):
                    valid = False
                self.assertEqual(valid, case['valid'])
