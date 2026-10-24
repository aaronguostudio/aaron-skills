"""Stable-release updates. Network failure never means 'up to date'."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
from uuid import uuid4

from platform_tools import installation_lock
from runtime_activity import runtime_activity
import managed_registration

REPOSITORY = 'aaronguostudio/aaron-skills'
RELEASE_API = f'https://api.github.com/repos/{REPOSITORY}/releases/latest'
ASSET_PREFIX = f'https://github.com/{REPOSITORY}/releases/download/'
DESCRIPTOR = 'aaron-skills-update.json'
CHECK_INTERVAL = 24 * 60 * 60
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_CONTENT = 128 * 1024 * 1024


def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp-' + uuid4().hex)
    try:
        temporary.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def version_tuple(value):
    if not isinstance(value, str) or not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value):
        raise ValueError('Expected a stable major.minor.patch version')
    return tuple(map(int, value.split('.')))


def policy_metadata(value):
    if not isinstance(value, dict) or value.get('kind') not in ('compatible', 'review'):
        raise ValueError('Release must explicitly declare compatible or review update policy')
    epoch = value.get('compatibilityEpoch')
    summary = value.get('summary')
    if not isinstance(epoch, str) or not re.fullmatch(r'[a-zA-Z0-9._-]{1,80}', epoch):
        raise ValueError('Release needs a compatibility epoch')
    if not isinstance(summary, list) or not 1 <= len(summary) <= 7 or any(not isinstance(s, str) or not s.strip() or len(s) > 300 or any(ord(c) < 32 for c in s) for s in summary):
        raise ValueError('Release needs 1–7 short, plain-text change summaries')
    return value


def current_release(root):
    release = managed_registration.active_release(root) if os.name == 'nt' else (root / 'current').resolve()
    if release is None or not release.is_relative_to((root / 'releases').resolve()) or not (release / 'READY').is_file():
        raise ValueError('No ready managed Demo installation')
    return release


def installed_manifest(release):
    return read_json(release / 'bundle-manifest.json')


def state_for(root, manifest):
    state = read_json(root / 'updates/state.json', {})
    state.setdefault('policy', 'compatible')
    # A check for another installed version cannot describe this one.
    if state.get('checkedId') != manifest['id']:
        for key in ('checkedAt', 'result'):
            state.pop(key, None)
    return state


def fetch(url, maximum):
    request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'Aaron-Skills-Updater'})
    with urllib.request.urlopen(request, timeout=5) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError('Update response exceeds the size limit')
    return data


def latest_release():
    release = json.loads(fetch(RELEASE_API, 256 * 1024))
    if not isinstance(release, dict) or release.get('draft') or release.get('prerelease'):
        raise ValueError('Update feed did not return a stable published release')
    tag = release.get('tag_name', '')
    version_tuple(tag.removeprefix('v'))
    assets = {asset['name']: asset for asset in release.get('assets', [])}
    asset = assets.get(DESCRIPTOR, {})
    prefix = ASSET_PREFIX + tag + '/'
    url = asset.get('browser_download_url', '')
    if not url.startswith(prefix) or url != prefix + DESCRIPTOR:
        raise ValueError('This release has no verified update descriptor yet')
    candidate = json.loads(fetch(url, 64 * 1024))
    if not isinstance(candidate, dict) or candidate.get('schema') != 1 or candidate.get('version') != tag.removeprefix('v'):
        raise ValueError('Update descriptor does not match the published release')
    policy_metadata(candidate.get('update'))
    if not re.fullmatch(r'[0-9a-f]{40}', candidate.get('sourceRevision', '')) or not re.fullmatch(r'[0-9a-f]{64}', candidate.get('sha256', '')):
        raise ValueError('Update descriptor has invalid provenance or checksum')
    archive_name = f'aaron-skills-demo-{candidate["version"]}.tar.gz'
    archive_url = assets.get(archive_name, {}).get('browser_download_url', '')
    if archive_url != prefix + archive_name:
        raise ValueError('Update archive must belong to the same official release')
    return {**candidate, 'archiveUrl': archive_url, 'releaseUrl': f'https://github.com/{REPOSITORY}/releases/tag/{tag}'}


def classify(current, candidate):
    old, new = version_tuple(current['version']), version_tuple(candidate['version'])
    if new <= old:
        return 'current'
    old_policy = current.get('update') or {}
    update = policy_metadata(candidate['update'])
    if (not current.get('sourceDirty', True) and update['kind'] == 'compatible'
            and old[:2] == new[:2] and old_policy.get('compatibilityEpoch') == update['compatibilityEpoch']):
        return 'compatible'
    return 'review'


def check(root, manifest, state, *, force=False):
    now = time.time()
    interval = 3600 if state.get('result', {}).get('status') == 'unknown' else CHECK_INTERVAL
    if not force and 0 <= now - state.get('checkedAt', 0) < interval and state.get('result'):
        return state['result']
    try:
        candidate = latest_release()
        result = {'status': classify(manifest, candidate), 'candidate': candidate}
    except (OSError, ValueError, KeyError, TypeError) as error:
        result = {'status': 'unknown', 'message': f'Update check failed ({type(error).__name__}); latest version is unknown. Retry: aaron-demo update check'}
    state.update(checkedAt=now, checkedId=manifest['id'], result=result)
    write_json(root / 'updates/state.json', state)
    return result


def safe_relative(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or '\\' in value or ':' in value or path.as_posix() != value:
        raise ValueError('Unsafe path in update bundle')
    return path


def verify_bundle(release, *, candidate=None):
    manifest = installed_manifest(release)
    if not isinstance(manifest, dict) or manifest.get('schema') != 1 or manifest.get('bundle') != 'demo':
        raise ValueError('Invalid Demo bundle manifest')
    version_tuple(manifest.get('version'))
    files = manifest.get('files')
    if not isinstance(files, dict) or not files or len(files) > 3000:
        raise ValueError('Invalid bundle file list')
    for relative, digest in files.items():
        safe_relative(relative)
        path = release / relative
        if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest) or path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(release.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Modified or missing bundle file: {relative}')
    expected_id = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()[:16]
    if manifest.get('id') != expected_id:
        raise ValueError('Bundle content identity does not match its files')
    if candidate:
        if manifest.get('sourceDirty') is not False or any(manifest.get(key) != candidate.get(key) for key in ('version', 'sourceRevision', 'id', 'update')):
            raise ValueError('Update archive does not match its descriptor')
    return manifest


def unpack(data, destination, candidate):
    try:
        return _unpack(data, destination, candidate)
    except tarfile.TarError as error:
        raise ValueError('Invalid update archive') from error


def _unpack(data, destination, candidate):
    import io
    if hashlib.sha256(data).hexdigest() != candidate['sha256']:
        raise ValueError('Update archive checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        members = []
        total = 0
        seen = set()
        for member in archive:
            total += member.size
            if len(members) >= 4000 or total > MAX_CONTENT:
                raise ValueError('Update archive exceeds extraction limits')
            safe_relative(member.name)
            if member.name in seen or not member.isfile():
                raise ValueError('Update archives contain plain, unique files only')
            seen.add(member.name)
            members.append(member)
        for member in members:
            path = destination / member.name
            path.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, path.open('wb') as target:
                target.write(source.read())
    manifest = verify_bundle(destination, candidate=candidate)
    if seen != set(manifest['files']) | {'bundle-manifest.json'}:
        raise ValueError('Update archive contains files outside the bundle manifest')
    return manifest


def apply_update(root, release, config, candidate):
    # Refuse to silently discard local edits, even when symlink registrations
    # themselves still look managed.
    verify_bundle(release)
    with tempfile.TemporaryDirectory(prefix='aaron-skills-update-') as directory:
        source = Path(directory) / 'source'
        source.mkdir()
        unpack(fetch(candidate['archiveUrl'], MAX_ARCHIVE), source, candidate)
        command = [config['tools']['python'], str(source / 'scripts/install.py'), '--root', str(root),
                   '--agent', config['agent'], '--bin-dir', config['binDir'], '--expected-active', str(release)]
        # Supply ALL existing host paths; never fall back to global defaults.
        for path in config.get('skillsDirs', [config['skillsDir']]):
            command.extend(['--registration-dir', path])
        from cli import environment
        subprocess.run(command, env={**environment(config), 'AARON_SKILLS_NO_UPDATE': '1'}, check=True)
    active = current_release(root)
    verify_bundle(active, candidate=candidate)
    return active


def show_result(manifest, result):
    print(f'Aaron Skills Demo {manifest["version"]}')
    status = result['status']
    if status == 'unknown':
        print(result['message'])
    elif status == 'current':
        print('No newer stable release is available.')
    else:
        candidate = result['candidate']
        print(f'{candidate["version"]} available — {"compatible patch" if status == "compatible" else "review required"}')
        for line in candidate['update']['summary']:
            print(f'  - {line}')
        print(candidate['releaseUrl'])
        if status == 'review':
            print('Review the changes, then run: aaron-demo update --yes')


def notice(root, manifest):
    try:
        with installation_lock(root / 'updates'):
            _notice(root, manifest)
    except ValueError:
        pass


def _notice(root, manifest):
    """Replay local notices only: no network or update on the caller's path."""
    state = state_for(root, manifest)
    if state['policy'] == 'off':
        return
    message = state.get('notice')
    result = state.get('result', {})
    if not message and result.get('status') in ('review', 'compatible'):
        candidate = result['candidate']
        if state.get('snoozeVersion') == candidate['version'] and time.time() < state.get('snoozeUntil', 0):
            return
        message = f'Aaron Skills {candidate["version"]} is available. Run aaron-demo update to see changes; update snooze postpones reminders.'
    if message and (message != state.get('lastNotice') or time.time() - state.get('lastNoticeAt', 0) >= CHECK_INTERVAL):
        print(message, file=sys.stderr)
        state.update(lastNotice=message, lastNoticeAt=time.time())
        state.pop('notice', None)
        write_json(root / 'updates/state.json', state)


def start_background(root, release, config):
    if os.environ.get('AARON_SKILLS_NO_UPDATE') == '1' or (root / '.updates-disabled').exists() or installed_manifest(release).get('sourceDirty', True):
        return
    state = state_for(root, installed_manifest(release))
    if state['policy'] == 'off':
        return
    directory = root / 'updates'
    directory.mkdir(parents=True, exist_ok=True)
    log = directory / 'update.log'
    if log.exists() and log.stat().st_size > 128 * 1024:
        log.write_text('', encoding='utf-8')
    options = {'creationflags': subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS} if os.name == 'nt' else {'start_new_session': True}
    with log.open('ab') as output:
        subprocess.Popen([config['tools']['python'], str(release / 'scripts/cli.py'), 'update', '--worker'],
                         stdin=subprocess.DEVNULL, stdout=output, stderr=output, close_fds=True, **options)


def worker(root):
    try:
        with installation_lock(root / 'updates'):
            release = current_release(root)
            manifest = installed_manifest(release)
            config = read_json(release / 'installed.json')
            state = state_for(root, manifest)
            if state['policy'] == 'off' or (root / '.updates-disabled').exists() or manifest.get('sourceDirty', True):
                return
            result = check(root, manifest, state)
            if result['status'] == 'compatible' and state['policy'] == 'compatible' and time.time() >= state.get('retryAfter', 0):
                try:
                    active = apply_update(root, release, config, result['candidate'])
                except (OSError, ValueError, subprocess.SubprocessError) as error:
                    state['notice'] = f'Aaron Skills update was deferred or failed ({type(error).__name__}); run aaron-demo update to retry. The current task can continue.'
                    # Avoid preparing dependencies on every command after a failure.
                    state['retryAfter'] = time.time() + 3600
                else:
                    updated = installed_manifest(active)
                    state.update(checkedId=updated['id'], result={'status': 'current'}, checkedAt=time.time(),
                                 notice=f'Aaron Skills updated {manifest["version"]} → {updated["version"]}. Start a new agent session to load refreshed skills. Revert with: aaron-demo rollback')
                write_json(root / 'updates/state.json', state)
    except (OSError, ValueError, KeyError, TypeError):
        # Background activity must never interrupt the user's command.
        return


def rollback(root):
    with installation_lock(root / 'updates'):
        _rollback(root)


def _rollback(root):
    from install import activate_release
    with installation_lock(root):
        active = current_release(root)
        previous = read_json(root / 'previous-release.json', {})
        target = Path(previous.get('release', '')).resolve()
        if target == active or not target.is_relative_to((root / 'releases').resolve()) or not (target / 'READY').is_file():
            raise ValueError('No previous ready release is available in this installation')
        manifest = verify_bundle(target)
        config = read_json(active / 'installed.json')
        from cli import environment
        # Use the retained runtime's doctor before touching any registration.
        subprocess.run([config['tools']['python'], '-c',
                        'import sys,json;sys.path.insert(0,sys.argv[1]);import cli;sys.exit(cli.doctor(json.loads(sys.argv[2]),check_links=False))',
                        str(target / 'scripts'), json.dumps(config)],
                       env={**environment(config), 'AARON_SKILLS_NO_UPDATE': '1'}, check=True)
        activate_release(root, target, config, manifest['skills'])
        state = state_for(root, manifest)
        state.update(policy='notify', checkedId=manifest['id'], notice=None)
        state.pop('result', None)
        state.pop('checkedAt', None)
        write_json(root / 'updates/state.json', state)
    print(f'Rolled back to Aaron Skills {manifest["version"]}. Automatic installation is paused (notify mode). Start a new agent session.')


def main(root, release, config, args):
    parser = argparse.ArgumentParser(prog='aaron-demo update')
    parser.add_argument('action', nargs='?', choices=['check', 'policy', 'snooze'])
    parser.add_argument('value', nargs='?', choices=['compatible', 'notify', 'off'])
    parser.add_argument('--yes', action='store_true', help='Install a reviewed larger update')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--background', action='store_true', help='Check/update without delaying this command')
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    options = parser.parse_args(args)
    if options.worker:
        return worker(root) or 0
    if options.background:
        notice(root, installed_manifest(release))
        start_background(root, release, config)
        return 0
    with installation_lock(root / 'updates'):
        manifest = installed_manifest(release)
        state = state_for(root, manifest)
        if options.action == 'policy':
            if options.value:
                state['policy'] = options.value
                write_json(root / 'updates/state.json', state)
            print(f'Update policy: {state["policy"]}')
            return 0
        if options.action == 'snooze':
            candidate = state.get('result', {}).get('candidate', {})
            version = candidate.get('version')
            count = min(state.get('snoozeCount', 0) + 1, 3) if state.get('snoozeVersion') == version else 1
            hours = (24, 48, 168)[count - 1]
            state.update(snoozeVersion=version, snoozeCount=count, snoozeUntil=time.time() + hours * 3600)
            write_json(root / 'updates/state.json', state)
            print(f'Update reminders postponed for {hours} hours. Update policy is unchanged.')
            return 0
        result = check(root, manifest, state, force=True)
        if options.json:
            print(json.dumps({'installed': manifest['version'], 'policy': state['policy'], **result}, indent=2))
        else:
            show_result(manifest, result)
        if options.action == 'check' or options.json or result['status'] in ('current', 'unknown'):
            return int(result['status'] == 'unknown')
        if result['status'] == 'review' and not options.yes:
            return 0
        active = apply_update(root, release, config, result['candidate'])
        updated = installed_manifest(active)
        state.update(checkedId=updated['id'], checkedAt=time.time(), result={'status': 'current'},
                     notice=None)
        write_json(root / 'updates/state.json', state)
        print(f'Updated to {updated["version"]}. Start a new agent session. Roll back with: aaron-demo rollback')
        return 0
