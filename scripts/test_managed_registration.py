"""Copy registration transactions run without symlinks or elevated privileges."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from managed_registration import activate, active_release, check_conflicts, digest, errors, uninstall


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='registration 中文 ')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'runtime'; self.root.mkdir()
        self.skills = self.base / 'skills'; self.bin = self.base / 'bin'
        self.names = ['demo-capture']
        self.first = self.release('first', 'first instructions')
        self.second = self.release('second', 'second instructions')
        self.config = {'skillsDirs': [str(self.skills)], 'binDir': str(self.bin)}

    def release(self, name, text):
        release = self.root / 'releases' / name
        folder = release / 'skills/demo-capture'; folder.mkdir(parents=True)
        (folder / 'SKILL.md').write_text(text, encoding='utf-8')
        return release

    def install(self, release):
        activate(self.root, release, [self.skills], self.bin, self.names, self.base / 'Python 中文/python.exe')

    def test_update_and_rollback_use_a_pointer_and_verified_copies(self):
        self.install(self.first)
        self.assertEqual(errors(self.root, self.first, self.config, self.names), [])
        self.assertFalse((self.skills / 'demo-capture').is_symlink())
        self.assertTrue((self.bin / 'aaron-demo.cmd').read_bytes().isascii())
        self.assertTrue((self.bin / 'aaron-demo.ps1').read_bytes().startswith(b'\xef\xbb\xbf'))
        self.install(self.second)
        self.assertEqual(active_release(self.root), self.second)
        self.assertEqual(digest(self.skills / 'demo-capture'), digest(self.second / 'skills/demo-capture'))
        self.install(self.first)
        self.assertEqual(errors(self.root, self.first, self.config, self.names), [])

    def test_unrelated_and_modified_skills_are_preserved(self):
        self.skills.mkdir()
        unrelated = self.skills / 'other'; unrelated.mkdir(); (unrelated / 'SKILL.md').write_text('other')
        self.install(self.first)
        changed = self.skills / 'demo-capture/SKILL.md'; changed.write_text('user edit')
        with self.assertRaisesRegex(ValueError, 'preserved'):
            self.install(self.second)
        self.assertEqual(active_release(self.root), self.first)
        uninstall(self.root, self.config, self.names)
        self.assertEqual(changed.read_text(), 'user edit')
        self.assertTrue(unrelated.is_dir())
        self.assertFalse((self.bin / 'aaron-demo.cmd').exists())

    def test_unmanaged_command_conflict_stops_before_activation(self):
        self.bin.mkdir(); (self.bin / 'aaron-demo.cmd').write_text('another tool')
        with self.assertRaisesRegex(ValueError, 'preserved'):
            self.install(self.first)
        self.assertIsNone(active_release(self.root))
        self.assertFalse(self.skills.exists())

    def test_failure_mid_activation_restores_previous_files_and_pointer(self):
        self.install(self.first)
        previous = (self.root / 'registrations.json').read_bytes()
        original = Path.replace
        def fail_on_pointer(path, target):
            if path.name.startswith('active.json.stage-'):
                raise OSError('simulated file sharing violation')
            return original(path, target)
        with patch.object(Path, 'replace', fail_on_pointer), self.assertRaisesRegex(OSError, 'sharing violation'):
            self.install(self.second)
        self.assertEqual(active_release(self.root), self.first)
        self.assertEqual((self.root / 'registrations.json').read_bytes(), previous)
        self.assertEqual(errors(self.root, self.first, self.config, self.names), [])
        self.assertFalse(list(self.base.rglob('*.stage-*')))
        self.assertFalse(list(self.base.rglob('*.backup-*')))

    def test_pointer_cannot_escape_the_installation(self):
        (self.root / 'active.json').write_text(json.dumps({'release': str(self.base)}))
        with self.assertRaisesRegex(ValueError, 'inside'):
            active_release(self.root)

    def test_same_release_configuration_is_restored_when_registration_fails(self):
        self.install(self.first)
        configuration = self.first / 'installed.json'
        configuration.write_text('{"previous": true}')
        previous = configuration.read_bytes()
        original = Path.replace
        def fail_on_pointer(path, target):
            if path.name.startswith('active.json.stage-'):
                raise OSError('activation failed')
            return original(path, target)
        with patch.object(Path, 'replace', fail_on_pointer), self.assertRaises(OSError):
            activate(self.root, self.first, [self.skills], self.bin, self.names, self.base / 'python.exe', configuration={'changed': True})
        self.assertEqual(configuration.read_bytes(), previous)
        self.assertEqual(active_release(self.root), self.first)
