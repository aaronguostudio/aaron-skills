"""Public boundary regressions, including exact-index and force-add behavior."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from benchmark_privacy import check_files, check_repository, REGISTRY, ROOT


def fixture():
    policy = {'schema': 1, 'privateCases': 'disabled', 'frameworkFiles': [REGISTRY],
              'cases': [{'id': 'demo', 'path': 'benchmarks/demo', 'sourceType': 'synthetic',
                         'dataPolicy': 'synthetic-only', 'credentials': 'synthetic-only'}]}
    files = {REGISTRY: policy, 'benchmarks/demo/case.json': {'id': 'demo'},
             'benchmarks/demo/results/metrics.json': {'score': 90}}
    files['bundles/source.json'] = {'files': list(files)}
    return {name: json.dumps(value).encode() for name, value in files.items()}


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.blobs = fixture()

    def add(self, name, content=b'public-looking text', declared=True):
        self.blobs[name] = content
        if declared:
            source = json.loads(self.blobs['bundles/source.json'])
            source['files'].append(name)
            self.blobs['bundles/source.json'] = json.dumps(source).encode()

    def test_declared_synthetic_case_and_aggregate_pass(self):
        check_files(self.blobs)

    def test_current_public_blog_records_pass(self):
        from release import public_files
        check_files({name: path.read_bytes() for name, path in public_files().items()})

    def test_missing_registry_fails_closed(self):
        del self.blobs[REGISTRY]
        with self.assertRaisesRegex(ValueError, 'registry'):
            check_files(self.blobs)

    def test_private_source_cannot_be_registered(self):
        policy = json.loads(self.blobs[REGISTRY])
        policy['cases'][0]['sourceType'] = 'private'
        self.blobs[REGISTRY] = json.dumps(policy).encode()
        with self.assertRaisesRegex(ValueError, 'registry'):
            check_files(self.blobs)

    def test_private_cases_cannot_be_enabled(self):
        policy = json.loads(self.blobs[REGISTRY]); policy['privateCases'] = 'enabled'
        self.blobs[REGISTRY] = json.dumps(policy).encode()
        with self.assertRaisesRegex(ValueError, 'registry'):
            check_files(self.blobs)

    def test_new_case_is_refused_even_if_added_to_source_manifest(self):
        self.add('benchmarks/unregistered/case.json', b'{"id":"unregistered"}')
        with self.assertRaisesRegex(ValueError, 'not explicitly approved'):
            check_files(self.blobs)

    def test_new_file_requires_source_allowlist(self):
        self.add('benchmarks/demo/results/extra.json', b'{}', declared=False)
        with self.assertRaisesRegex(ValueError, 'not explicitly approved'):
            check_files(self.blobs)

    def test_raw_media_logs_and_browser_state_are_refused(self):
        for path in ['benchmarks/demo/artifacts/note.md', 'benchmarks/demo/video.mp4',
                     'benchmarks/demo/shot.png', 'benchmarks/demo/steps.json',
                     'benchmarks/demo/trace.jsonl', 'notes/execution.json', 'notes/state.json', 'notes/render-manifest.json']:
            with self.subTest(path=path):
                blobs = copy.deepcopy(self.blobs)
                self.add(path, b'{}')
                with self.assertRaisesRegex(ValueError, 'raw evidence|raw evidence/media'):
                    check_files(self.blobs)
                self.blobs = blobs

    def test_private_directory_and_credential_file_outside_benchmarks_are_refused(self):
        for name in ['private-benchmarks/note.md', 'notes/report.private.json', 'notes/.env.local']:
            with self.subTest(name=name):
                blobs = {**self.blobs, name: b'not for publication'}
                with self.assertRaises(ValueError):
                    check_files(blobs)

    def test_private_classification_in_an_approved_result_is_refused(self):
        self.blobs['benchmarks/demo/results/metrics.json'] = b'{"visibility":"private","score":90}'
        with self.assertRaisesRegex(ValueError, 'private/internal classification'):
            check_files(self.blobs)

    def test_session_shaped_json_in_renamed_approved_result_is_refused(self):
        self.blobs['benchmarks/demo/results/metrics.json'] = b'{"cookies":[{"value":"fixture-secret"}]}'
        with self.assertRaises(ValueError) as error:
            check_files(self.blobs)
        self.assertNotIn('fixture-secret', str(error.exception))

    def test_inline_media_is_not_a_way_to_publish_a_screenshot(self):
        self.blobs['benchmarks/demo/results/metrics.json'] = b'{"image":"data:image/png;base64,YWJj"}'
        with self.assertRaisesRegex(ValueError, 'embedded raw media'):
            check_files(self.blobs)

    def test_renamed_empty_browser_state_is_refused_outside_benchmarks(self):
        self.blobs['notes/summary.json'] = b'{"cookies":[],"origins":[]}'
        with self.assertRaisesRegex(ValueError, 'session/credential-shaped'):
            check_files(self.blobs)

    def test_personal_path_and_token_are_refused_without_echoing_values(self):
        for sensitive in ['/' + 'Users' + '/' + 'private-fixture/internal',
                          'C:' + chr(92) + 'Users' + chr(92) + 'private-fixture' + chr(92) + 'internal',
                          'C:' + chr(92) * 2 + 'Users' + chr(92) * 2 + 'private-fixture' + chr(92) * 2 + 'internal',
                          'ghp_' + 'A' * 30]:
            blobs = {**self.blobs, 'notes/summary.md': sensitive.encode()}
            with self.assertRaises(ValueError) as error:
                check_files(blobs)
            self.assertNotIn(sensitive, str(error.exception))

    def test_open_source_registration_requires_revision_and_license(self):
        policy = json.loads(self.blobs[REGISTRY]); case = policy['cases'][0]
        case.update(sourceType='open-source', dataPolicy='public-only', credentials='none', sourceUrl='https://example.org/project')
        self.blobs[REGISTRY] = json.dumps(policy).encode()
        with self.assertRaisesRegex(ValueError, 'registry'):
            check_files(self.blobs)
        case.update(license='MIT', sourceRevision='a' * 40)
        self.blobs[REGISTRY] = json.dumps(policy).encode()
        check_files(self.blobs)

    def test_source_export_uses_the_same_boundary(self):
        from release import scan_public
        self.blobs['benchmarks/demo/results/metrics.json'] = b'{"visibility":"private"}'
        with tempfile.TemporaryDirectory() as directory:
            paths = {}
            for name, data in self.blobs.items():
                path = Path(directory) / name
                path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
                paths[name] = path
            with self.assertRaisesRegex(ValueError, 'private/internal classification'):
                scan_public(paths)


class GitIndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'core.hooksPath', '/dev/null')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', '1+fixture@users.noreply.github.com')
        for name, data in fixture().items():
            self.write(name, data)
        self.git('add', '.')

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], stderr=subprocess.PIPE)

    def write(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
        return path

    def test_clean_worktree_cannot_hide_private_staged_blob(self):
        name = 'benchmarks/demo/results/metrics.json'
        self.write(name, b'{"classification":"private"}'); self.git('add', name)
        self.write(name, b'{"score":90}')
        check_repository(self.root, staged=False)
        with self.assertRaisesRegex(ValueError, 'private/internal classification'):
            check_repository(self.root, staged=True)

    def test_git_force_add_cannot_bypass_checker(self):
        self.write('.gitignore', b'*.jsonl\n')
        self.write('notes/events.jsonl', b'{}')
        self.git('add', '-f', 'notes/events.jsonl')
        with self.assertRaisesRegex(ValueError, 'raw evidence'):
            check_repository(self.root, staged=True)

    def test_staged_policy_cannot_be_hidden_by_public_worktree_policy(self):
        public = (self.root / REGISTRY).read_bytes()
        policy = json.loads(public); policy['privateCases'] = 'enabled'
        self.write(REGISTRY, json.dumps(policy).encode()); self.git('add', REGISTRY)
        self.write(REGISTRY, public)
        check_repository(self.root, staged=False)
        with self.assertRaisesRegex(ValueError, 'registry'):
            check_repository(self.root, staged=True)

    def test_staged_symlink_is_refused(self):
        # Git can create this index entry without OS symlink privileges on Windows.
        oid = self.git('hash-object', '-w', 'benchmarks/demo/case.json')
        self.git('update-index', '--add', '--cacheinfo', '120000', oid.decode().strip(), 'notes/link')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            check_repository(self.root, staged=True)

    def test_real_precommit_hook_blocks_forced_raw_log(self):
        checker = ROOT / 'scripts/benchmark_privacy.py'
        self.write('scripts/benchmark_privacy.py', checker.read_bytes())
        hook = self.write('.githooks/pre-commit', (ROOT / '.githooks/pre-commit').read_bytes())
        hook.chmod(0o755)
        self.git('add', '.'); self.git('config', 'core.hooksPath', '.githooks')
        self.git('commit', '-m', 'Public synthetic fixture')
        self.write('notes/events.jsonl', b'{}'); self.git('add', '-f', 'notes/events.jsonl')
        result = subprocess.run(['git', '-C', str(self.root), 'commit', '-m', 'Must be blocked'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('raw evidence', result.stderr)
        self.assertEqual(self.git('rev-list', '--count', 'HEAD').strip(), b'1')


if __name__ == '__main__':
    unittest.main()
