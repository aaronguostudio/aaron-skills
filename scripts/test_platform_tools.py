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
from platform_tools import check_system, npm_command, bun_binary, private_path


class PlatformTests(unittest.TestCase):
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

    def test_pinned_bun_is_an_executable_on_the_current_host(self):
        binary = bun_binary(bundle.ROOT / 'packages/demo/remotion')
        self.assertTrue(binary.is_file())
        import subprocess
        result = subprocess.run([str(binary), '--version'], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '1.4.3')
