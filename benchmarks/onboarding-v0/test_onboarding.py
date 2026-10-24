"""The score must not turn incomplete, mocked or inherited-context evidence into acceptance."""
import importlib.util
import json
import tempfile
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('onboarding_runner', HERE / 'run.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
from score import grade


class OnboardingTests(unittest.TestCase):
    def report(self):
        case = json.loads((HERE / 'case.json').read_text())
        return {'providerEvidence': 'synthetic-loopback-only', 'humanAcceptance': 'not-assessed',
                'nativeAgent': 'not-assessed', 'stages': [{'id': name, 'status': 'passed'} for name in case['requiredStages']]}

    def test_every_required_stage_is_a_gate_not_an_average(self):
        report = self.report()
        self.assertTrue(grade(report)['passed'])
        report['stages'][-1]['status'] = 'failed'
        self.assertFalse(grade(report)['passed'])
        report['stages'].pop()
        self.assertFalse(grade(report)['passed'])
        report = self.report()
        report['stages'].append(dict(report['stages'][0]))
        self.assertFalse(grade(report)['passed'])

    def test_scripted_success_cannot_claim_human_or_native_acceptance(self):
        for key in ('humanAcceptance', 'nativeAgent'):
            report = self.report(); report[key] = 'passed'
            self.assertFalse(grade(report)['passed'])
        report = self.report(); report['providerEvidence'] = 'live'
        self.assertFalse(grade(report)['passed'])

    def test_child_profile_does_not_inherit_credentials_or_developer_context(self):
        ambient = {'PATH': '/fixture/tools', 'HOME': '/fixture/developer', 'CODEX_HOME': '/fixture/developer-codex',
                   'ELEVENLABS_API_KEY': 'synthetic-key', 'GEMINI_API_KEY': 'synthetic-key',
                   'AARON_DEMO_VOICE_PROFILES': '/fixture/existing.json', 'OPENAI_API_KEY': 'synthetic-key',
                   'DEMO_CAPTURE_HOME': '/fixture/existing-sessions'}
        result = runner.clean_environment(Path('/fixture/new-user'), Path('/fixture/trial'), ambient)
        self.assertEqual(result['PATH'], ambient['PATH'])
        for key in ('CODEX_HOME', 'ELEVENLABS_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'):
            self.assertNotIn(key, result)
        self.assertNotEqual(result['HOME'], ambient['HOME'])
        self.assertNotEqual(result['AARON_DEMO_VOICE_PROFILES'], ambient['AARON_DEMO_VOICE_PROFILES'])
        self.assertEqual(result['AARON_SKILLS_NO_UPDATE'], '1')

    def test_trial_cannot_store_raw_artifacts_inside_a_checkout(self):
        with self.assertRaisesRegex(ValueError, 'outside every Git'):
            runner.require_external(HERE / 'ignored-output')

    def test_native_grade_checks_artifacts_instead_of_accepting_a_final_claim(self):
        spec = importlib.util.spec_from_file_location('native_onboarding', HERE / 'native.py')
        native = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(native)
        with tempfile.TemporaryDirectory() as temporary:
            artifacts = Path(temporary)
            (artifacts / 'final.txt').write_text('Everything passed; a great video is ready.')
            result = native.collect(artifacts, 'unused-ffprobe')
            self.assertFalse(result['passed'])
            self.assertFalse(any(result['checks'].values()))


if __name__ == '__main__':
    unittest.main()
