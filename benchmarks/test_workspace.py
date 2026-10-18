from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from workspace import require_external


class WorkspaceTests(unittest.TestCase):
    def test_nested_ignored_directory_is_still_inside_git(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.git').mkdir()
            with self.assertRaises(ValueError):
                require_external(root / '.ignored/artifacts/new')

    def test_linked_worktree_git_file_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.git').write_text('gitdir: example')
            with self.assertRaises(ValueError):
                require_external(root / 'new')

    def test_external_new_path_is_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'new/artifacts'
            self.assertEqual(require_external(target), target.resolve())

    def test_symlink_cannot_hide_a_repository_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); checkout = root / 'checkout'; checkout.mkdir()
            (checkout / '.git').mkdir()
            alias = root / 'alias'
            try:
                alias.symlink_to(checkout, target_is_directory=True)
            except OSError:
                self.skipTest('OS token cannot create a directory symlink')
            with self.assertRaises(ValueError):
                require_external(alias / 'new')

    def test_cli_entrypoints_refuse_git_output_before_execution(self):
        scripts = Path(__file__).resolve().parent / 'blog-v0'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); checkout = root / 'checkout'; checkout.mkdir()
            (checkout / '.git').mkdir()
            target = checkout / 'must-not-be-created'
            cases = [
                ('prepare.py', ['--blog-repo', str(checkout), '--workspace', str(target)]),
                ('run.py', ['--workspace', str(target), '--trial', '1']),
                ('collect.py', ['--trial', str(root / 'external-trial'), '--out', str(target / 'evidence.json')]),
                ('offline_proxy.py', ['--workspace', str(target)]),
            ]
            for script, args in cases:
                with self.subTest(script=script):
                    result = subprocess.run([sys.executable, str(scripts / script), *args], capture_output=True, text=True, timeout=10)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('outside every Git repository', result.stderr)
                    self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
