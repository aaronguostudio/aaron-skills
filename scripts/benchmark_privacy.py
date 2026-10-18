#!/usr/bin/env python3
"""Check public benchmark boundaries; inspect index blobs before commit, not their worktree substitutes."""
import argparse
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = 'benchmarks/public-cases.json'
SOURCE = 'bundles/source.json'
SOURCE_TYPES = {'public-blog', 'open-source', 'synthetic'}
TEXT_TYPES = {'.md', '.json', '.csv', '.py', '.mjs', '.js', '.ts', '.tsx', '.html', '.css', '.yaml', '.yml', '.toml', '.txt'}
PRIVATE_DIRS = {'private', '.private', 'private-benchmarks', 'benchmarks-private', '.benchmark-private'}
RAW_DIRS = {'artifacts', 'capture-state', 'sessions', 'recordings', 'screenshots', 'raw', 'runs'}
RAW_NAMES = {'capture.json', 'steps.json', 'state.json', 'session.json', 'storage-state.json', 'storage_state.json', 'storagestate.json',
             'cookies.json', 'execution.json', 'render-manifest.json', 'events.jsonl', 'prompt.txt', 'final.txt', 'stderr.log'}
RAW_SUFFIXES = {'.mp4', '.webm', '.mp3', '.wav', '.har', '.jsonl', '.log', '.pem', '.key', '.zip', '.gz', '.7z', '.sqlite', '.db'}
HOME_PATH = re.compile(r'/(?:Users|home)/([^/\s\x22\x27`]+)')
WINDOWS_HOME = re.compile(r'[A-Za-z]:\\{1,2}Users\\{1,2}([^\\\s\x22\x27`]+)', re.I)
TOKEN = re.compile(r'\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|AKIA[0-9A-Z]{16})\b')
KEY = re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----')
INLINE_MEDIA = re.compile(r'data:(?:image|video|audio)/[^;\s]+;base64,[A-Za-z0-9+/]')


def safe_path(name):
    path = PurePosixPath(name)
    return bool(name) and not path.is_absolute() and '..' not in path.parts and '\\' not in name and str(path) == name


def json_risks(value):
    """Inspect JSON metadata; do not echo credential values or arbitrary source text."""
    risks = set()
    if isinstance(value, dict):
        for key, item in value.items():
            normalized = key.lower().replace('_', '').replace('-', '')
            if normalized in {'visibility', 'classification', 'dataclassification', 'sourcetype'} and isinstance(item, str) and item.lower() in {'private', 'internal', 'confidential', 'customer', 'proprietary'}:
                risks.add('private/internal classification')
            if normalized in {'cookies', 'origins', 'storagestate'} or (normalized in {'accesstoken', 'refreshtoken', 'authorization', 'password'} and item):
                risks.add('session/credential-shaped JSON')
            risks.update(json_risks(item))
    elif isinstance(value, list):
        for item in value:
            risks.update(json_risks(item))
    return risks


def check_files(blobs):
    """Validate a complete candidate tree represented as relative name -> bytes."""
    failures = []
    benchmark_names = [name for name in blobs if name.startswith('benchmarks/')]
    framework, prefixes, allowed = set(), [], set()
    if benchmark_names:
        try:
            policy = json.loads(blobs[REGISTRY])
            source = json.loads(blobs[SOURCE])
            if policy['schema'] != 1 or policy['privateCases'] != 'disabled':
                raise ValueError('Private benchmark cases must remain disabled')
            framework = set(policy['frameworkFiles'])
            if REGISTRY not in framework or any(not safe_path(p) or not p.startswith('benchmarks/') for p in framework):
                raise ValueError('Invalid framework allowlist')
            ids = set()
            for case in policy['cases']:
                if case['id'] in ids or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', case['id']):
                    raise ValueError('Duplicate or invalid public case ID')
                ids.add(case['id'])
                if case['path'] != 'benchmarks/' + case['id'] or case['sourceType'] not in SOURCE_TYPES:
                    raise ValueError('Unapproved public benchmark source or path')
                synthetic = case['sourceType'] == 'synthetic'
                if case['dataPolicy'] != ('synthetic-only' if synthetic else 'public-only') or case['credentials'] != ('synthetic-only' if synthetic else 'none'):
                    raise ValueError('Case data/credential policy does not match its source')
                if not synthetic and not re.fullmatch(r'https://[^\s]+', case['sourceUrl']):
                    raise ValueError('Public source URL is required')
                if case['sourceType'] == 'open-source' and (not case.get('license') or not case.get('sourceRevision')):
                    raise ValueError('Open-source cases need license and pinned source revision')
                if case['path'] + '/case.json' not in blobs:
                    raise ValueError('Registered public case definition is missing')
                prefixes.append(case['path'] + '/')
            allowed = set(source['files'])
            for name in allowed:
                if name.startswith('benchmarks/') and name not in blobs:
                    failures.append(f'{name}: declared benchmark file is missing')
        except (KeyError, TypeError, ValueError):
            # Do not print parsed values, malformed JSON or their surrounding content.
            failures.append('benchmarks: missing/invalid public registry or source manifest; private cases are disabled')
    for name, data in blobs.items():
        path = PurePosixPath(name)
        lower_parts = [part.lower() for part in path.parts]
        benchmark = name.startswith('benchmarks/')
        if not safe_path(name):
            failures.append('repository: invalid candidate path (value withheld)')
            continue
        if any(part in PRIVATE_DIRS for part in lower_parts) or '.private.' in path.name.lower():
            failures.append(f'{name}: private material belongs outside this repository')
        if path.name.lower() in RAW_NAMES or path.suffix.lower() in RAW_SUFFIXES or (path.name.startswith('.env') and path.name != '.env.example'):
            failures.append(f'{name}: raw evidence/session/credential file is not public source')
        if benchmark:
            if name not in allowed or (name not in framework and not any(name.startswith(p) for p in prefixes)):
                failures.append(f'{name}: benchmark file/case is not explicitly approved for public source')
            if any(part in RAW_DIRS for part in lower_parts[1:-1]) or path.suffix.lower() not in TEXT_TYPES:
                failures.append(f'{name}: benchmark raw evidence/media is forbidden, including force-added files')
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError:
            if benchmark:
                failures.append(f'{name}: binary benchmark material is forbidden')
            continue  # Existing website artwork is outside benchmark source.
        if KEY.search(text) or TOKEN.search(text):
            failures.append(f'{name}: potential credential (value withheld)')
        if any(m[1].lower() not in {'a', 'me', 'test', 'tester', 'user', 'example'} for pattern in (HOME_PATH, WINDOWS_HOME) for m in pattern.finditer(text)):
            failures.append(f'{name}: personal home path (value withheld)')
        if benchmark:
            if INLINE_MEDIA.search(text):
                failures.append(f'{name}: embedded raw media is forbidden')
        if path.suffix == '.json':
            try:
                for risk in sorted(json_risks(json.loads(text))):
                    failures.append(f'{name}: {risk} (values withheld)')
            except ValueError:
                if benchmark:
                    failures.append(f'{name}: invalid benchmark JSON')
    if failures:
        raise ValueError('Public benchmark boundary failed:\n' + '\n'.join(sorted(set(failures))))


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)


def repository_files(root, staged):
    blobs = {}
    for entry in git(root, 'ls-files', '--stage', '-z').split(b'\0'):
        if not entry:
            continue
        metadata, name_bytes = entry.split(b'\t', 1)
        mode, oid, stage = metadata.decode().split()
        name = name_bytes.decode('utf-8')
        if stage != '0' or mode not in {'100644', '100755'}:
            raise ValueError(f'{name}: unresolved merge, symlink or gitlink is not reviewable public source')
        path = root / name
        if not staged and (path.is_symlink() or not path.resolve().is_relative_to(root.resolve())):
            raise ValueError(f'{name}: worktree path leaves the repository')
        blobs[name] = git(root, 'cat-file', 'blob', oid) if staged else path.read_bytes()
    return blobs


def check_repository(root=ROOT, staged=False):
    check_files(repository_files(root, staged))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--staged', action='store_true', help='Check the exact complete Git index; pre-commit gate')
    group.add_argument('--tracked', action='store_true', help='Check worktree contents of Git-tracked files; local/CI gate')
    args = parser.parse_args()
    check_repository(staged=args.staged)
    print('Public benchmark boundary passed. Unmarked confidential prose still requires human review.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, UnicodeError, ValueError, subprocess.CalledProcessError):
        # ValueError messages contain paths/categories only, never file contents.
        error = sys.exc_info()[1]
        sys.exit(str(error) if isinstance(error, ValueError) else 'Benchmark boundary could not inspect all candidate files; refusing to continue.')
