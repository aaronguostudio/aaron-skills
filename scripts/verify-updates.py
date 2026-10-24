#!/usr/bin/env python3
"""Real isolated upgrade/rollback through a synthetic loopback release feed."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

import bundle
from prepare_update import prepare
import updates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('root', 'skills-dir', 'bin-dir'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    root, skills, binaries = (p.resolve() for p in (args.root, args.skills_dir, args.bin_dir))
    if root.parent == Path.home() or not all(p.is_relative_to(root.parent) for p in (skills, binaries)):
        raise ValueError('Use all paths under one disposable validation workspace')
    if any((p / '.git').exists() for p in (root, *root.parents)):
        raise ValueError('Keep validation outside Git')
    initial = updates.current_release(root)
    config = updates.read_json(initial / 'installed.json')
    if set(config['skillsDirs']) != {str(skills)} or Path(config['binDir']) != binaries:
        raise ValueError('The installation must use exactly the supplied isolated paths')
    original_manifest = (initial / 'bundle-manifest.json').read_bytes()
    installed = updates.installed_manifest(initial)
    if not installed.get('update'):
        raise ValueError('Install the current updater implementation first')
    major, minor, patch = updates.version_tuple(installed['version'])
    target_version = f'{major}.{minor}.{patch + 1}'
    state_path = root / 'updates/state.json'
    original_state = state_path.read_bytes() if state_path.is_file() else None
    requests = []
    responses = {}
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            content = responses.get(self.path)
            self.send_response(200 if content else 503)
            self.end_headers()
            if content:
                self.wfile.write(content)
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    address = f'http://127.0.0.1:{server.server_port}'
    env = {**os.environ, 'AARON_SKILLS_NO_UPDATE': '1'}
    def invoke(*arguments, success=True):
        release = updates.current_release(root)
        result = subprocess.run([sys.executable, '-c',
            'import sys;sys.path.insert(0,sys.argv[1]);import updates,cli;'
            'updates.RELEASE_API=sys.argv[2]+"/latest";updates.ASSET_PREFIX=sys.argv[2]+"/download/";'
            'sys.argv=["aaron-demo",*sys.argv[3:]];sys.exit(cli.main())',
            str(release / 'scripts'), address, *arguments], env=env, capture_output=True, text=True, encoding='utf-8')
        if success and result.returncode:
            raise ValueError(f'Update validation failed: {arguments}\n{result.stdout}\n{result.stderr}')
        if not success and result.returncode == 0:
            raise ValueError(f'Expected failure: {arguments}')
        print(result.stdout, end='')
        return result
    try:
        # Model a clean published installation, only in this disposable workspace.
        installed['sourceDirty'] = False
        updates.write_json(initial / 'bundle-manifest.json', installed)
        updates.write_json(state_path, {'policy': 'compatible'})
        with tempfile.TemporaryDirectory(prefix='aaron-skills-update-fixture-', dir=root.parent) as temporary:
            source = Path(temporary) / 'source'
            bundle.build(source)
            specification = updates.read_json(source / 'bundles/demo.json')
            specification.update(version=target_version, update={
                'kind': 'compatible', 'compatibilityEpoch': installed['update']['compatibilityEpoch'],
                'summary': ['Synthetic compatible update for isolated verification.']})
            updates.write_json(source / 'bundles/demo.json', specification)
            manifest = bundle.metadata(source)
            manifest.update(sourceDirty=False, sourceRevision='a' * 40)
            updates.write_json(source / 'bundle-manifest.json', manifest)
            assets = Path(temporary) / 'assets'
            descriptor = prepare(assets, root=source, tag='v' + target_version)
            prefix = '/download/v' + target_version + '/'
            asset_list = []
            for asset in assets.iterdir():
                responses[prefix + asset.name] = asset.read_bytes()
                asset_list.append({'name': asset.name, 'browser_download_url': address + prefix + asset.name})
            responses['/latest'] = json.dumps({'tag_name': 'v' + target_version, 'assets': asset_list}).encode()
            invoke('update', 'check')
            if updates.current_release(root) != initial:
                raise ValueError('Check-only changed the active version')
            invoke('update', '--worker')
            upgraded = updates.current_release(root)
            if upgraded == initial or updates.installed_manifest(upgraded)['version'] != target_version:
                raise ValueError('The automatic compatible update did not activate')
            invoke('doctor')
            # A larger release must notify without downloading/installing its archive.
            downloads = sum(name.endswith('.tar.gz') for name in requests)
            next_version = f'{major}.{minor + 1}.0'
            next_prefix = '/download/v' + next_version + '/'
            next_descriptor = {**descriptor, 'version': next_version}
            responses[next_prefix + updates.DESCRIPTOR] = json.dumps(next_descriptor).encode()
            responses['/latest'] = json.dumps({'tag_name': 'v' + next_version, 'assets': [
                {'name': updates.DESCRIPTOR, 'browser_download_url': address + next_prefix + updates.DESCRIPTOR},
                {'name': f'aaron-skills-demo-{next_version}.tar.gz', 'browser_download_url': address + next_prefix + f'aaron-skills-demo-{next_version}.tar.gz'}]}).encode()
            result = invoke('update')
            if 'review required' not in result.stdout or updates.current_release(root) != upgraded or downloads != sum(name.endswith('.tar.gz') for name in requests):
                raise ValueError('A larger update did not remain review-only')
            responses.pop('/latest')
            result = invoke('update', 'check', success=False)
            if 'unknown' not in result.stdout:
                raise ValueError('An unavailable feed was incorrectly reported as current')
            invoke('rollback')
            if updates.current_release(root) != initial or updates.read_json(state_path)['policy'] != 'notify':
                raise ValueError('Rollback failed or automatic installation was not paused')
            invoke('doctor')
            invoke('version', '--json')
            report = {'passed': True, 'syntheticLoopbackOnly': True, 'compatibleAutomaticUpgrade': True,
                      'largerUpdateRequiresReview': True, 'failedCheckIsUnknown': True,
                      'rollbackVerified': True, 'rollbackPausesAutomaticInstall': True,
                      'customPathsRetained': True, 'initialVersion': installed['version'], 'targetVersion': target_version}
            updates.write_json(root.parent / 'updates-report.json', report)
            print(json.dumps(report, indent=2))
    finally:
        server.shutdown()
        server.server_close()
        (initial / 'bundle-manifest.json').write_bytes(original_manifest)
        if original_state is None:
            state_path.unlink(missing_ok=True)
        else:
            state_path.write_bytes(original_state)


if __name__ == '__main__':
    main()
