"""Platform boundaries preserve manifests and invoke real binaries, not shell shims."""
import os
import base64
import json
from pathlib import Path, PureWindowsPath
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import bundle
from platform_tools import check_media_tools, check_system, npm_command, bun_binary, private_path


class PlatformTests(unittest.TestCase):
    def test_media_preflight_requires_both_working_tools(self):
        with patch('platform_tools.subprocess.run') as run:
            with self.assertRaisesRegex(ValueError, 'ffprobe is required'):
                check_media_tools({'ffmpeg': 'ffmpeg'})
            run.side_effect = [subprocess.CompletedProcess(['ffmpeg'], 0), subprocess.CalledProcessError(1, ['ffprobe'])]
            with self.assertRaisesRegex(ValueError, 'could not run'):
                check_media_tools({'ffmpeg': 'ffmpeg', 'ffprobe': 'ffprobe'})
            run.side_effect = None
            self.assertEqual(check_media_tools({'ffmpeg': 'ffmpeg', 'ffprobe': 'ffprobe'})['ffprobe'], 'ffprobe')

    @unittest.skipUnless(os.name == 'nt', 'Native Windows dependency setup')
    def test_windows_media_setup_retries_false_success_and_refuses_exhaustion(self):
        script = str(bundle.ROOT / 'scripts/install-ci-media.ps1').replace("'", "''")
        for ready_after, installer_exit, expected_attempts, success in ((2, 0, 2, True), (99, 0, 3, False), (1, 1, 3, False)):
            command = f"""
$global:attempt = 0
function choco {{ $global:attempt++; Write-Output "INSTALL_ATTEMPT_$global:attempt"; $global:LASTEXITCODE = {installer_exit} }}
function ffmpeg {{ $global:LASTEXITCODE = 0 }}
function ffprobe {{ if ($global:attempt -ge {ready_after}) {{ $global:LASTEXITCODE = 0 }} else {{ $global:LASTEXITCODE = 1 }} }}
& '{script}' -RetrySeconds 0
"""
            encoded = base64.b64encode(command.encode('utf-16le')).decode()
            result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], capture_output=True, text=True)
            self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
            self.assertEqual(result.stdout.count('INSTALL_ATTEMPT_'), expected_attempts)
            self.assertIn('FFmpeg and ffprobe are ready.' if success else 'Windows media setup failed', result.stdout + result.stderr)

    @unittest.skipUnless(os.name == 'nt', 'Windows DACL contract')
    def test_private_acl_removes_explicit_public_access_and_can_be_reapplied(self):
        with tempfile.TemporaryDirectory(prefix='private 中文 ') as directory:
            root = Path(directory)
            private_path(root, directory=True)
            file = root / "session's state.json"
            file.write_text('{}')
            subprocess.run(['icacls.exe', str(file), '/grant', '*S-1-1-0:R'], check=True, capture_output=True)
            private_path(file)
            private_path(file)
            quoted = str(file).replace("'", "''")
            script = ("$a=Get-Acl -LiteralPath '" + quoted + "';"
                      "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;"
                      "[ordered]@{protected=$a.AreAccessRulesProtected;identity=$sid;allowed=@("
                      "$a.Access | Where-Object AccessControlType -eq Allow | ForEach-Object {"
                      "$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value})} | ConvertTo-Json")
            encoded = base64.b64encode(script.encode('utf-16le')).decode()
            actual = json.loads(subprocess.check_output(['powershell.exe', '-NoProfile', '-NonInteractive',
                                '-EncodedCommand', encoded], text=True, encoding='utf-8'))
            self.assertTrue(actual['protected'])
            self.assertEqual(actual['allowed'], [actual['identity']])

    def test_manifest_references_do_not_depend_on_host_path_separator(self):
        files = bundle.bundle_files()
        with patch.object(bundle, 'Path', PureWindowsPath):
            bundle.check_imports(files)
            bundle.check_documents(files)

    def test_ubuntu_24_is_accepted_and_other_distros_are_explicitly_unverified(self):
        with patch('platform_tools.platform.system', return_value='Linux'):
            with patch('platform_tools.platform.freedesktop_os_release', return_value={'ID': 'ubuntu', 'VERSION_ID': '24.04'}):
                check_system()
            with patch('platform_tools.platform.freedesktop_os_release', return_value={'ID': 'alpine', 'VERSION_ID': '3.22'}):
                with self.assertRaisesRegex(ValueError, 'Ubuntu 24.04'):
                    check_system()

    def test_windows_npm_shim_is_resolved_to_node_and_javascript(self):
        with tempfile.TemporaryDirectory(prefix='node tools ') as directory:
            root = Path(directory)
            shim = root / 'npm.cmd'; shim.touch()
            cli = root / 'node_modules/npm/bin/npm-cli.js'
            cli.parent.mkdir(parents=True); cli.touch()
            tools = {'node': str(root / 'node.exe'), 'npm': str(shim)}
            self.assertEqual(npm_command(tools, 'ci'), [tools['node'], str(cli.resolve()), 'ci'])
            cli.unlink()
            with self.assertRaisesRegex(ValueError, 'npm-cli.js'):
                npm_command(tools, 'ci')

    @unittest.skipIf(os.name == 'nt', 'POSIX multi-call symlink dispatch')
    def test_npm_symlink_preserves_the_dispatch_name_and_working_directory(self):
        with tempfile.TemporaryDirectory(prefix='node shims ') as directory:
            root = Path(directory)
            for name in ('volta-shim', 'vp'):
                dispatcher = root / name
                dispatcher.write_text('#!/bin/sh\ncase "$0" in */npm) printf "%s" "$PWD:$1";; *) exit 126;; esac\n')
                dispatcher.chmod(0o755)
                npm = root / 'npm'
                npm.symlink_to(dispatcher)
                tools = {'node': 'unused', 'npm': str(npm)}
                result = subprocess.run(npm_command(tools, 'ci'), cwd=root, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, f'{root.resolve()}:ci')
                npm.unlink()

    def test_pinned_bun_is_an_executable_on_the_current_host(self):
        binary = bun_binary(bundle.ROOT / 'packages/demo/remotion')
        self.assertTrue(binary.is_file())
        import subprocess
        result = subprocess.run([str(binary), '--version'], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '1.4.3')
