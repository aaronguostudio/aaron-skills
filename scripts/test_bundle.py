"""Observable packaging and registration invariants; no downloads or client access."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import bundle
from install import atomic_link, installation_lock, link_conflicts, registration_dirs, uninstall, verify_installed_smoke

class BundleTests(unittest.TestCase):
    def test_host_registration_uses_native_directories_and_preserves_other_skills(self):
        home = Path('/example-home')
        self.assertEqual(registration_dirs('codex', home), [home / '.agents/skills'])
        self.assertEqual(registration_dirs('claude', home), [home / '.claude/skills'])
        self.assertEqual(registration_dirs('cursor', home), [home / '.cursor/skills'])
        self.assertEqual(registration_dirs('cursor', home, home / 'project/.cursor/skills'), [(home / 'project/.cursor/skills').resolve()])
        self.assertEqual(len(registration_dirs('both', home)), 2)
        with self.assertRaises(ValueError): registration_dirs('both', home, home / 'override')

    def test_failed_post_activation_smoke_reports_retained_installation_and_retry(self):
        command = [sys.executable, '/example with spaces/scripts/cli.py', 'smoke']
        def fail(argv):
            raise subprocess.CalledProcessError(3, argv)
        with self.assertRaisesRegex(ValueError, 'Runtime installed and activated') as raised:
            verify_installed_smoke(fail, command)
        self.assertIn('not verified', str(raised.exception))
        self.assertIn('/example with spaces/scripts/cli.py', str(raised.exception))
        seen = []
        verify_installed_smoke(seen.append, command)
        self.assertEqual(seen, [command])

    def test_windows_smoke_retry_is_a_quoted_powershell_invocation(self):
        command = ['C:/Python Tools/python.exe', "C:/demo's runtime/scripts/cli.py", 'smoke']
        def fail(argv):
            raise subprocess.CalledProcessError(3, argv)
        with patch('install.os.name', 'nt'):
            with self.assertRaises(ValueError) as raised:
                verify_installed_smoke(fail, command)
        self.assertIn("& 'C:/Python Tools/python.exe' 'C:/demo''s runtime/scripts/cli.py' 'smoke'", str(raised.exception))

    @unittest.skipIf(os.name == 'nt', 'POSIX symlink layout; copy registrations have separate transaction tests')
    def test_uninstall_removes_only_our_links_and_retains_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'runtime'
            release = root / 'releases/test'; release.mkdir(parents=True)
            skills, binaries = Path(directory) / 'skills', Path(directory) / 'bin'
            skills.mkdir(); binaries.mkdir()
            (release / 'skills').mkdir()
            for name in bundle.SKILLS: (release / 'skills' / name).mkdir()
            (release / 'aaron-demo').write_text('launcher')
            (release / 'installed.json').write_text(json.dumps({'skillsDir': str(skills), 'binDir': str(binaries)}))
            atomic_link(release, root / 'current')
            for path, target in link_conflicts(root, skills, binaries).items(): atomic_link(target, path)
            (skills / 'demo-capture').unlink()
            (skills / 'demo-capture').mkdir()  # User replacement must survive.
            uninstall(root)
            self.assertTrue((skills / 'demo-capture').is_dir())
            self.assertFalse((binaries / 'aaron-demo').exists())
            self.assertTrue(release.is_dir())
    def test_export_has_only_allowlisted_plain_files_and_complete_runtime(self):
        with tempfile.TemporaryDirectory(prefix='demo-export-') as directory:
            output = Path(directory) / 'bundle with spaces'
            manifest = bundle.build(output)
            actual = {path.relative_to(output).as_posix() for path in output.rglob('*') if path.is_file()}
            self.assertEqual(actual, set(manifest['files']) | {'bundle-manifest.json'})
            self.assertFalse(any(path.is_symlink() for path in output.rglob('*')))
            self.assertFalse(any('src/content/' in path or '/build/' in path or '.env' in path for path in actual))
            self.assertFalse((output / 'provenance.json').exists())
            package = json.loads((output / 'packages/demo/remotion/package.json').read_text())
            self.assertEqual(package['dependencies']['remotion'], package['dependencies']['@remotion/cli'])
            self.assertTrue((output / 'packages/demo/remotion/src/projects/walkthrough-video/brand/BrandCard.tsx').exists())
            self.assertTrue((output / 'packages/demo/walkthrough/brand.ts').exists())
            self.assertEqual(manifest['skills'], ['paste-ready-update', 'demo-capture', 'walkthrough-video'])

    def test_export_never_overwrites_or_exports_into_source(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileExistsError):
                bundle.build(Path(directory))
        with self.assertRaisesRegex(ValueError, 'outside'):
            bundle.build(bundle.ROOT / 'demo-export')

    @unittest.skipIf(os.name == 'nt', 'POSIX symlink layout; copy registrations have separate transaction tests')
    def test_registration_preserves_unrelated_entries_including_broken_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            skills = root / 'skills'
            skills.mkdir()
            (skills / 'demo-capture').symlink_to(root / 'missing')
            with self.assertRaisesRegex(ValueError, 'preserved'):
                link_conflicts(root / 'install', skills, root / 'bin')
            self.assertTrue((skills / 'demo-capture').is_symlink())

    @unittest.skipIf(os.name == 'nt', 'POSIX symlink layout; copy registrations have separate transaction tests')
    def test_update_switches_only_managed_links_and_handles_spaces(self):
        with tempfile.TemporaryDirectory(prefix='demo tools ') as directory:
            root = Path(directory)
            skills = root / 'skills'; skills.mkdir()
            binaries = root / 'bin'; binaries.mkdir()
            install = root / 'install'
            wanted = link_conflicts(install, skills, binaries)
            for link, target in wanted.items():
                atomic_link(target, link)
            self.assertEqual(link_conflicts(install, skills, binaries), wanted)
            atomic_link(root / 'release 1', root / 'current')
            atomic_link(root / 'release 2', root / 'current')
            self.assertEqual((root / 'current').readlink(), root / 'release 2')

    def test_modified_export_is_never_reported_as_clean_committed_source(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'export'
            manifest = bundle.build(output)
            manifest['sourceDirty'] = False  # model an export made from a committed revision
            (output / 'bundle-manifest.json').write_text(json.dumps(manifest))
            self.assertFalse(bundle.metadata(output)['sourceDirty'])
            (output / 'docs/installation.md').write_text('changed locally')
            changed = bundle.metadata(output)
            self.assertTrue(changed['sourceDirty'])
            self.assertEqual(changed['sourceRevision'], manifest['sourceRevision'])

    def test_export_refuses_a_manifest_missing_a_transitive_module(self):
        files = bundle.bundle_files()
        del files['packages/demo/remotion/src/projects/walkthrough-video/brand/model.ts']
        with self.assertRaisesRegex(ValueError, 'Missing bundled imports'):
            bundle.check_imports(files)

    def test_second_installer_is_refused_and_lock_is_released_after_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            command = [sys.executable, '-c', 'from pathlib import Path; from install import installation_lock; import sys;\nwith installation_lock(Path(sys.argv[1])): print("acquired")', str(root)]
            environment = dict(os.environ, PYTHONPATH=str(Path(__file__).parent))
            with self.assertRaisesRegex(RuntimeError, 'simulated failure'):
                with installation_lock(root):
                    result = subprocess.run(command, env=environment, text=True, capture_output=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('Another installer is running', result.stderr)
                    raise RuntimeError('simulated failure')
            result = subprocess.run(command, env=environment, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)

if __name__ == '__main__':
    unittest.main()
