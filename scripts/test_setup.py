"""Bootstrap must preserve arguments and never install system packages implicitly."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class SetupTests(unittest.TestCase):
    def test_bootstrap_forwards_host_options_without_system_changes(self):
        result, log = self.run_setup(['--agent', 'claude', '--smoke'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('scripts/install.py --agent claude --smoke', log)
        self.assertNotIn('brew install', log)

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

    def run_setup(self, args, missing_ffmpeg=False):
        with tempfile.TemporaryDirectory() as directory:
            bin_dir = Path(directory) / 'bin'; bin_dir.mkdir()
            log = Path(directory) / 'calls'
            stubs = {
                'uname': '#!/bin/sh\necho Darwin\n',
                'python3': '#!/bin/sh\nif [ "$1" = -c ]; then exit 0; fi\necho "$*" >> "$SETUP_TEST_LOG"\n',
                'node': '#!/bin/sh\nexit 0\n',
                'git': '#!/bin/sh\nexit 0\n',
            }
            if not missing_ffmpeg:
                stubs.update(ffmpeg='#!/bin/sh\nexit 0\n', ffprobe='#!/bin/sh\nexit 0\n')
            for name, text in stubs.items():
                path = bin_dir / name; path.write_text(text); path.chmod(0o755)
            env = {**os.environ, 'PATH': str(bin_dir) + ':/usr/bin:/bin', 'SETUP_TEST_LOG': str(log)}
            result = subprocess.run(['/bin/bash', 'scripts/setup.sh', *args],
                                    cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True, text=True)
            return result, log.read_text() if log.exists() else ''
