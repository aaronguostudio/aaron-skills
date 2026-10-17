"""Public export must preserve reviewable source while dropping private history."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from release import export, public_files, scan_public


class ReleaseTests(unittest.TestCase):
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
