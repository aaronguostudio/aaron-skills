"""Bootstrap must preserve arguments and never install system packages implicitly."""
import os
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest


@unittest.skipIf(os.name == 'nt', 'POSIX bootstrap; Windows uses setup.ps1')
class SetupTests(unittest.TestCase):
    def test_bootstrap_forwards_host_options_without_system_changes(self):
        result, log = self.run_setup(['--agent', 'claude', '--smoke'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('scripts/install.py --agent claude --smoke', log)
        self.assertNotIn('brew install', log)

    def test_cursor_registration_option_reaches_the_shared_installer(self):
        result, log = self.run_setup(['--agent', 'cursor', '--smoke'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('scripts/install.py --agent cursor --smoke', log)

    def test_missing_prerequisite_stops_before_installation_without_opt_in(self):
        result, log = self.run_setup(['--agent', 'codex'], missing_ffmpeg=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn('Missing prerequisites', result.stderr)
        self.assertNotIn('scripts/install.py', log)

    def test_package_manager_is_not_bootstrapped_implicitly(self):
        result, log = self.run_setup(['--install-prerequisites'], missing_ffmpeg=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn('Install Homebrew', result.stderr)
        self.assertNotIn('scripts/install.py', log)

    def test_linux_bootstrap_forwards_options_without_installing_system_packages(self):
        result, log = self.run_setup(['--agent', 'codex', '--smoke'], system='Linux')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('scripts/install.py --agent codex --smoke', log)
        result, log = self.run_setup(['--install-prerequisites'], missing_ffmpeg=True, system='Linux')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Ubuntu needs', result.stderr)
        self.assertNotIn('scripts/install.py', log)

    def test_node_prerequisite_uses_real_node(self):
        node = shutil.which('node')
        self.assertIsNotNone(node, 'The source gate requires Node 22+')
        # Exercise the actual JS in setup.sh: stubbing node hid ERR_INVALID_ARG_TYPE.
        result, log = self.run_setup(['--agent', 'codex'], system='Linux', real_node=node)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('scripts/install.py --agent codex', log)

    def test_node_prerequisite_rejects_old_node(self):
        result, log = self.run_setup(['--agent', 'codex'], system='Linux', old_node=True)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertNotIn('scripts/install.py', log)

    def test_linux_display_warning_is_advisory_and_respects_display_variables(self):
        from cli import capture_display_warning
        warning = capture_display_warning('linux', {})
        self.assertIn('xvfb-run', warning)
        self.assertIn('headless smoke can still pass', warning)
        for env in ({'DISPLAY': ':99'}, {'WAYLAND_DISPLAY': 'wayland-0'}):
            self.assertIsNone(capture_display_warning('linux', env))
        for platform in ('darwin', 'win32'):
            self.assertIsNone(capture_display_warning(platform, {}))

    def run_setup(self, args, missing_ffmpeg=False, system='Darwin', real_node=None, old_node=False):
        with tempfile.TemporaryDirectory() as directory:
            bin_dir = Path(directory) / 'bin'; bin_dir.mkdir()
            log = Path(directory) / 'calls'
            stubs = {
                'uname': f'#!/bin/sh\necho {system}\n',
                'dirname': '#!/bin/sh\necho scripts\n',
                'python3': '#!/bin/sh\nif [ "$1" = -c ]; then exit 0; fi\necho "$*" >> "$SETUP_TEST_LOG"\n',
                'node': '#!/bin/sh\nexit 0\n',
                'git': '#!/bin/sh\nexit 0\n',
            }
            if not missing_ffmpeg:
                stubs.update(ffmpeg='#!/bin/sh\nexit 0\n', ffprobe='#!/bin/sh\nexit 0\n')
            for name, text in stubs.items():
                path = bin_dir / name; path.write_text(text); path.chmod(0o755)
            if real_node:
                (bin_dir / 'node').unlink()
                (bin_dir / 'node').symlink_to(real_node)
            elif old_node:
                (bin_dir / 'node').write_text('#!/bin/sh\nexit 1\n')
            env = {**os.environ, 'PATH': str(bin_dir), 'SETUP_TEST_LOG': str(log)}
            result = subprocess.run(['/bin/bash', 'scripts/setup.sh', *args],
                                    cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True, text=True)
            return result, log.read_text() if log.exists() else ''
