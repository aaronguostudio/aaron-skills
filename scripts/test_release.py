"""Public export must preserve reviewable source while dropping private history."""
import json
import hashlib
from pathlib import Path
import subprocess
import tempfile
import unittest

from release import export, public_files, scan_public, scan_history


class ReleaseTests(unittest.TestCase):
    def test_only_hash_reviewed_generated_webp_assets_are_accepted(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / 'cover.webp'
            Image.new('RGB', (2, 2), '#123456').save(image, 'WEBP')
            spec = root / 'source.json'
            files = {'cover.webp': image, 'bundles/source.json': spec}
            spec.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'unreviewed binary'):
                scan_public(files)
            def approve():
                spec.write_text(json.dumps({'reviewedBinaryAssets': {'cover.webp': {
                    'sourceType': 'generated', 'mediaType': 'image/webp',
                    'sha256': hashlib.sha256(image.read_bytes()).hexdigest()}}}))
            approve()
            scan_public(files)
            image.write_bytes(image.read_bytes() + b'changed')
            with self.assertRaisesRegex(ValueError, 'unreviewed binary'):
                scan_public(files)
            image.write_bytes(image.read_bytes() + b'\nsk-' + b'x' * 30)
            approve()
            with self.assertRaisesRegex(ValueError, 'potential secret'):
                scan_public(files)

    def test_normal_merge_emails_are_accepted_but_deleted_private_content_is_not(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'public'
            export(root, author_name='Fixture Maintainer', author_email='fixture@example.invalid')
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)
            def commit(message='Synthetic public change'):
                git('add', '--all')
                git('commit', '-m', message)
            git('checkout', '-b', 'fixture-change')
            (root / 'synthetic.txt').write_text('public fixture', encoding='utf-8')
            commit()
            git('checkout', 'main')
            git('-c', 'user.email=noreply@github.com', 'merge', '--no-ff', 'fixture-change', '-m', 'Synthetic GitHub merge')
            scan_history(root)
            self.assertEqual(git('show', '-s', '--format=%ce', 'HEAD').strip(), b'noreply@github.com')
            (root / 'synthetic.txt').write_text('/' + 'Users' + '/' + 'private-fixture/deleted', encoding='utf-8')
            commit()
            (root / 'synthetic.txt').unlink()
            commit()
            with self.assertRaisesRegex(ValueError, 'Personal path in reachable history blob'):
                scan_history(root)

    def test_secret_tripwires_still_reject_content_without_echoing_values(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'notes.md'
            for sensitive in ('sk-' + 'x' * 30, '-----BEGIN ' + 'PRIVATE KEY-----'):
                file.write_text(sensitive)
                with self.assertRaisesRegex(ValueError, 'potential (secret|credential)') as error:
                    scan_public({'notes.md': file})
                self.assertNotIn(sensitive, str(error.exception))

    def test_public_candidate_has_one_noreply_commit_and_no_internal_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'public source'
            result = export(output, author_name='Fixture Maintainer', author_email='1+fixture@users.noreply.github.com')
            self.assertEqual(result['commits'], 1)
            self.assertFalse(result['remotes'])
            self.assertFalse((output / 'provenance.json').exists())
            self.assertFalse((output / 'docs/three-arm-comparison.md').exists())
            self.assertTrue((output / 'scripts/test_release.py').is_file())
            email = subprocess.check_output(['git', '-C', str(output), 'log', '-1', '--format=%ae'], text=True).strip()
            self.assertEqual(email, '1+fixture@users.noreply.github.com')
            expected = json.loads((output / 'bundles/source.json').read_text())['files']
            self.assertEqual(set(result['files']), set(expected))
            with self.assertRaises(FileExistsError):
                export(output, author_name='Fixture Maintainer', author_email='1+fixture@users.noreply.github.com')

    def test_private_path_is_rejected_without_echoing_its_value(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'notes.md'
            sensitive = '/' + 'Users' + '/' + 'private-fixture/project'
            file.write_text(sensitive)
            with self.assertRaises(ValueError) as error:
                scan_public({'notes.md': file})
            self.assertNotIn(sensitive, str(error.exception))

    def test_public_manifest_contains_all_runtime_files(self):
        from bundle import bundle_files
        self.assertFalse(set(bundle_files()) - set(public_files()))

    def test_maintainer_imports_require_exported_test_fixtures(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            driver, fixture = root / 'driver.mjs', root / 'fixture.mjs'
            driver.write_text("import { fixture } from '../capture/test/fixture.mjs'\n")
            fixture.write_text('export const fixture = true\n')
            scan_public({'scripts/driver.mjs': driver, 'capture/test/fixture.mjs': fixture})
            with self.assertRaisesRegex(ValueError, 'Missing bundled imports'):
                scan_public({'scripts/driver.mjs': driver})
