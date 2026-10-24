"""Update policy, real archive integrity and activation/recovery regressions."""
from contextlib import redirect_stdout
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import bundle
import cli
import install
import updates
import prepare_update
from runtime_activity import runtime_activity


def policy(kind='compatible', epoch='demo-0.4'):
    return {'kind': kind, 'compatibilityEpoch': epoch, 'summary': ['Public synthetic update.']}


def make_release(path, version='0.4.1'):
    path.mkdir(parents=True)
    files = {}
    for name in bundle.SKILLS:
        relative = f'skills/{name}/SKILL.md'
        target = path / relative
        target.parent.mkdir(parents=True)
        target.write_text(version)
        files[relative] = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest = {'schema': 1, 'bundle': 'demo', 'version': version, 'sourceRevision': 'a' * 40,
                'sourceDirty': False, 'skills': list(bundle.SKILLS), 'files': files, 'update': policy(),
                'id': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()[:16]}
    updates.write_json(path / 'bundle-manifest.json', manifest)
    (path / 'READY').touch()
    (path / 'aaron-demo').write_text('launcher')
    updates.write_json(path / 'installed.json', {})
    return manifest


def archive_for(source, manifest, extra=None):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w:gz') as archive:
        for name in [*manifest['files'], 'bundle-manifest.json']:
            archive.add(source / name, arcname=name)
        if extra:
            member = tarfile.TarInfo(extra)
            member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
    data = buffer.getvalue()
    candidate = {key: manifest[key] for key in ('version', 'sourceRevision', 'id', 'update')}
    candidate.update(schema=1, sha256=hashlib.sha256(data).hexdigest(),
                     archiveUrl='https://github.com/aaronguostudio/aaron-skills/releases/download/v0.4.2/aaron-skills-demo-0.4.2.tar.gz',
                     releaseUrl='https://github.com/aaronguostudio/aaron-skills/releases/tag/v0.4.2')
    return data, candidate


class PolicyTests(unittest.TestCase):
    def test_empty_macos_trust_store_uses_system_ca_without_disabling_verification(self):
        from unittest.mock import MagicMock
        context = MagicMock()
        context.cert_store_stats.return_value = {'x509_ca': 0}
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'fixture'
        with patch('updates.sys.platform', 'darwin'), patch.dict(os.environ, {}, clear=True), \
                patch('updates.Path.is_file', return_value=True), \
                patch('updates.ssl.create_default_context', return_value=context) as secure_default, \
                patch('updates.urllib.request.urlopen', return_value=response) as request:
            self.assertEqual(updates.fetch('https://fixture.invalid', 20), b'fixture')
            secure_default.assert_called_once_with()
            context.load_verify_locations.assert_called_once_with(cafile='/etc/ssl/cert.pem')
            self.assertIs(request.call_args.kwargs['context'], context)
            context.load_verify_locations.reset_mock()
            with patch.dict(os.environ, {'SSL_CERT_FILE': '/fixture/company.pem'}):
                updates.fetch('https://fixture.invalid', 20)
            context.load_verify_locations.assert_not_called()
            context.cert_store_stats.return_value = {'x509_ca': 100}
            updates.fetch('https://fixture.invalid', 20)
            context.load_verify_locations.assert_not_called()

    def test_task_locks_allow_nested_processes_and_release_after_a_crash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = str(Path(__file__).parent)
            with runtime_activity(root):
                nested = subprocess.run([sys.executable, '-c',
                    'import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from runtime_activity import runtime_activity;'
                    '\nwith runtime_activity(Path(sys.argv[2])): print("shared")', script, str(root)],
                    capture_output=True, text=True, timeout=10)
                self.assertEqual(nested.returncode, 0, nested.stderr)
                with self.assertRaisesRegex(ValueError, 'busy'):
                    with runtime_activity(root, exclusive=True):
                        self.fail('Activation must not enter while a task is running')
            child = subprocess.Popen([sys.executable, '-c',
                'import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from runtime_activity import runtime_activity;'
                '\nwith runtime_activity(Path(sys.argv[2]),exclusive=True): print("held",flush=True);sys.stdin.read()', script, str(root)],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                self.assertEqual(child.stdout.readline().strip(), 'held')
                with self.assertRaisesRegex(ValueError, 'busy'):
                    with runtime_activity(root):
                        self.fail('A task must not enter during activation')
            finally:
                child.kill()
                child.communicate(timeout=10)
            with runtime_activity(root, exclusive=True):
                pass  # No stale PID/lock cleanup needed after a process dies.

    def test_only_explicit_same_series_and_epoch_clean_patches_auto_upgrade(self):
        current = {'version': '0.4.1', 'sourceDirty': False, 'update': policy()}
        candidate = {'version': '0.4.2', 'update': policy()}
        self.assertEqual(updates.classify(current, candidate), 'compatible')
        for altered in ({**candidate, 'version': '0.5.0'}, {**candidate, 'version': '1.0.0'},
                        {**candidate, 'update': policy('review')}, {**candidate, 'update': policy(epoch='changed')}):
            self.assertEqual(updates.classify(current, altered), 'review')
        for altered in ({**current, 'sourceDirty': True}, {**current, 'update': None},
                        {key: value for key, value in current.items() if key != 'update'}):
            self.assertEqual(updates.classify(altered, candidate), 'review')
        for version in ('0.4.1', '0.4.0'):
            self.assertEqual(updates.classify(current, {**candidate, 'version': version}), 'current')
        for version in ('0.4.2-beta', '01.2.3', 'latest'):
            with self.assertRaises(ValueError):
                updates.classify(current, {**candidate, 'version': version})

    def test_cached_failure_is_unknown_and_not_a_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {'id': 'old', 'version': '0.4.1', 'sourceDirty': False, 'update': policy()}
            state = {}
            with patch('updates.latest_release', side_effect=OSError('offline')) as fetch:
                result = updates.check(root, manifest, state)
                self.assertEqual(result['status'], 'unknown')
                self.assertEqual(updates.check(root, manifest, state), result)
                self.assertEqual(fetch.call_count, 1)
                updates.check(root, manifest, state, force=True)
                self.assertEqual(fetch.call_count, 2)
            self.assertEqual(updates.read_json(root / 'updates/state.json')['result']['status'], 'unknown')
            self.assertNotIn('checkedAt', updates.state_for(root, {'id': 'new'}))

    def test_feed_rejects_missing_assets_prereleases_and_foreign_downloads(self):
        base = {'tag_name': 'v0.4.2', 'assets': []}
        for release in (base, {**base, 'prerelease': True},
                        {**base, 'assets': [{'name': updates.DESCRIPTOR, 'browser_download_url': 'https://other.example/update.json'}]}):
            with patch('updates.fetch', return_value=json.dumps(release).encode()), self.assertRaises(ValueError):
                updates.latest_release()


class ArchiveTests(unittest.TestCase):
    def test_archive_links_and_oversized_members_are_rejected_before_writing(self):
        for kind in ('symlink', 'huge', 'invalid'):
            output = io.BytesIO()
            with tarfile.open(fileobj=output, mode='w:gz') as archive:
                member = tarfile.TarInfo('escape')
                if kind == 'symlink':
                    member.type = tarfile.SYMTYPE
                    member.linkname = '../outside'
                elif kind == 'huge':
                    member.size = updates.MAX_CONTENT + 1
                    # Header-only malformed member must be rejected before its
                    # body is read or allocated.
                    archive.fileobj.write(member.tobuf())
                    continue
                archive.addfile(member)
            data = output.getvalue() if kind != 'invalid' else b'invalid gzip'
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError):
                    updates.unpack(data, Path(directory), {'sha256': hashlib.sha256(data).hexdigest()})
                self.assertFalse(list(Path(directory).iterdir()))

    def test_release_asset_preparation_requires_clean_sources_and_matching_tag(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'assets'
            manifest = {'version': '0.4.1', 'update': policy(), 'sourceDirty': True, 'sourceRevision': 'a' * 40}
            with patch('prepare_update.metadata', return_value=manifest), self.assertRaisesRegex(ValueError, 'clean'):
                prepare_update.prepare(output)
            manifest['sourceDirty'] = False
            with patch('prepare_update.metadata', return_value=manifest), self.assertRaisesRegex(ValueError, 'tag'):
                prepare_update.prepare(output, tag='v0.4.2')
            self.assertFalse(output.exists())

    def test_checksum_provenance_manifest_and_plain_file_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / 'source'
            manifest = make_release(source, '0.4.2')
            data, candidate = archive_for(source, manifest)
            out = base / 'good'; out.mkdir()
            self.assertEqual(updates.unpack(data, out, candidate)['version'], '0.4.2')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                updates.unpack(data + b'changed', base / 'checksum', candidate)
            for extra in ('../escaped', '/absolute', 'C:/escape', 'skills\\escape', 'unlisted.py'):
                bad_data, bad_candidate = archive_for(source, manifest, extra)
                with self.assertRaises(ValueError):
                    updates.unpack(bad_data, base / 'invalid', bad_candidate)
            (out / 'skills/demo-capture/SKILL.md').write_text('user edit')
            with self.assertRaisesRegex(ValueError, 'Modified'):
                updates.verify_bundle(out)
            for field, value in (('sourceRevision', 'b' * 40), ('version', '0.4.3'), ('update', policy('review'))):
                with self.assertRaisesRegex(ValueError, 'descriptor'):
                    updates.unpack(data, base / ('mismatch-' + field), {**candidate, field: value})

    def test_exported_runtime_contains_updater_and_loads_without_source_imports(self):
        with tempfile.TemporaryDirectory() as directory:
            exported = Path(directory) / 'export'
            bundle.build(exported)
            result = subprocess.run([sys.executable, str(exported / 'scripts/cli.py'), '--help'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('rollback', result.stdout)
            self.assertIn('update', result.stdout)


@unittest.skipIf(os.name == 'nt', 'POSIX activation; Windows copy transactions have separate cross-platform tests')
class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='update tests ')
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name).resolve()
        self.root = base / 'runtime'
        self.first, self.second = self.root / 'releases/old', self.root / 'releases/new'
        self.old = make_release(self.first)
        self.new = make_release(self.second, '0.4.2')
        self.config = {'skillsDirs': [str(base / 'custom skills')], 'skillsDir': str(base / 'custom skills'),
                       'binDir': str(base / 'custom bin'), 'installRoot': str(self.root), 'agent': 'cursor',
                       'tools': {'python': sys.executable}, 'playwrightBrowsers': str(base / 'browsers')}
        for release in (self.first, self.second):
            updates.write_json(release / 'installed.json', self.config)
        install.activate_release(self.root, self.first, self.config, bundle.SKILLS)

    def test_activation_and_rollback_preserve_custom_paths_and_pause_auto_updates(self):
        install.activate_release(self.root, self.second, self.config, bundle.SKILLS)
        self.assertEqual(updates.current_release(self.root), self.second)
        self.assertEqual(updates.read_json(self.root / 'previous-release.json')['release'], str(self.first))
        with patch('updates.subprocess.run') as doctor, redirect_stdout(io.StringIO()):
            updates.rollback(self.root)
        self.assertIn('check_links=False', doctor.call_args.args[0][2])
        self.assertEqual(updates.current_release(self.root), self.first)
        self.assertEqual(updates.read_json(self.root / 'updates/state.json')['policy'], 'notify')
        for path in self.config['skillsDirs']:
            self.assertEqual((Path(path) / 'demo-capture').resolve(), self.first / 'skills/demo-capture')

    def test_rollback_can_leave_a_damaged_active_release_without_deleting_it(self):
        install.activate_release(self.root, self.second, self.config, bundle.SKILLS)
        damaged = self.second / 'skills/demo-capture/SKILL.md'
        damaged.write_text('retained local edit in the version being left')
        with patch('updates.subprocess.run'), redirect_stdout(io.StringIO()):
            updates.rollback(self.root)
        self.assertEqual(updates.current_release(self.root), self.first)
        self.assertEqual(damaged.read_text(), 'retained local edit in the version being left')

    def test_live_task_prevents_activation_and_failed_link_switch_restores_old_version(self):
        with runtime_activity(self.root):
            with self.assertRaisesRegex(ValueError, 'busy'):
                install.activate_release(self.root, self.second, self.config, bundle.SKILLS)
        self.assertEqual(updates.current_release(self.root), self.first)
        original = install.atomic_link
        failed = False
        def fail_once(target, link):
            nonlocal failed
            if link.name == 'demo-capture' and not failed:
                failed = True
                raise OSError('synthetic link failure')
            return original(target, link)
        with patch('install.atomic_link', fail_once), self.assertRaises(OSError):
            install.activate_release(self.root, self.second, self.config, bundle.SKILLS)
        self.assertEqual(updates.current_release(self.root), self.first)
        self.assertEqual((Path(self.config['skillsDir']) / 'demo-capture').resolve(), self.first / 'skills/demo-capture')
        self.assertFalse((self.root / 'previous-release.json').exists())

    def test_stale_preparation_and_uninstall_cannot_reactivate_an_update(self):
        install.activate_release(self.root, self.second, self.config, bundle.SKILLS)
        with self.assertRaisesRegex(ValueError, 'changed during'):
            install.activate_release(self.root, self.first, self.config, bundle.SKILLS, expected_active=self.first)
        (self.root / '.updates-disabled').touch()
        with self.assertRaisesRegex(ValueError, 'uninstalled'):
            install.activate_release(self.root, self.first, self.config, bundle.SKILLS, expected_active=self.second)
        self.assertEqual(updates.current_release(self.root), self.second)
        with patch('updates.latest_release') as check:
            updates.worker(self.root)
        check.assert_not_called()

    def test_worker_uses_current_pointer_and_only_runs_compatible_policy(self):
        data, candidate = archive_for(self.second, self.new)
        for policy_name in ('notify', 'off', 'compatible'):
            state = {'policy': policy_name, 'checkedId': self.old['id']}
            updates.write_json(self.root / 'updates/state.json', state)
            with patch('updates.latest_release', return_value=candidate), patch('updates.apply_update', side_effect=ValueError('busy')) as apply:
                updates.worker(self.root)
            self.assertEqual(apply.call_count, int(policy_name == 'compatible'))
        with patch('updates.apply_update') as apply:
            updates.worker(self.root)
        apply.assert_not_called()  # deferred attempts back off
        self.assertEqual(updates.current_release(self.root), self.first)

    def test_major_change_not_installed_without_explicit_yes(self):
        _, candidate = archive_for(self.second, {**self.new, 'version': '0.5.0'})
        with patch('updates.latest_release', return_value=candidate), patch('updates.apply_update') as apply, redirect_stdout(io.StringIO()) as output:
            self.assertEqual(updates.main(self.root, self.first, self.config, []), 0)
        apply.assert_not_called()
        self.assertIn('review required', output.getvalue())
        with redirect_stdout(io.StringIO()):
            updates.main(self.root, self.first, self.config, ['snooze'])
        state = updates.read_json(self.root / 'updates/state.json')
        self.assertGreater(state['snoozeUntil'], state['checkedAt'])

    def test_modified_release_or_registration_is_preserved(self):
        (self.first / 'skills/demo-capture/SKILL.md').write_text('local customization')
        with patch('updates.fetch') as fetch, self.assertRaisesRegex(ValueError, 'Modified'):
            updates.apply_update(self.root, self.first, self.config, {})
        fetch.assert_not_called()
        path = Path(self.config['skillsDir']) / 'demo-capture'
        path.unlink(); path.mkdir(); (path / 'SKILL.md').write_text('replacement')
        with self.assertRaisesRegex(ValueError, 'preserved'):
            install.activate_release(self.root, self.second, self.config, bundle.SKILLS)
        self.assertEqual((path / 'SKILL.md').read_text(), 'replacement')
        self.assertEqual(updates.current_release(self.root), self.first)


if __name__ == '__main__':
    unittest.main()
