import unittest
from evaluate import grade


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.expected = {'requiredSkills': ['walkthrough-video'], 'allowedSkills': ['walkthrough-video'],
                         'operation': 'render', 'reuseCapture': True, 'needsAuthorization': False}
        self.answer = {'selectedSkills': ['walkthrough-video'], 'operation': 'render',
                       'reuseCapture': True, 'needsAuthorization': False, 'delivery': 'prepare-only'}

    def test_narration_reuse_passes_without_requiring_specific_reason_wording(self):
        self.assertEqual(grade(self.answer, self.expected), [])

    def test_extra_recording_and_automatic_delivery_fail(self):
        self.answer.update(selectedSkills=['walkthrough-video', 'demo-capture'], operation='capture',
                           reuseCapture=False, delivery='send')
        self.assertEqual(len(grade(self.answer, self.expected)), 4)

    def test_missing_production_authorization_is_a_failure(self):
        expected = dict(self.expected, needsAuthorization=True)
        self.assertTrue(any('needsAuthorization' in error for error in grade(self.answer, expected)))


if __name__ == '__main__':
    unittest.main()
