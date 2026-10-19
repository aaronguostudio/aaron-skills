#!/usr/bin/env python3
"""Export a public source candidate with new history. Never pushes or creates a remote."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

from bundle import ROOT, check_documents, check_imports
from benchmark_privacy import check_files as check_benchmark_boundary


def public_files(root=ROOT):
    spec = json.loads((root / 'bundles/source.json').read_text(encoding='utf-8'))
    files = {}
    for name in spec['files']:
        path = Path(name)
        source = root / path
        if (path.is_absolute() or '..' in path.parts or name in files or source.is_symlink()
                or not source.is_file() or not source.resolve().is_relative_to(root.resolve())):
            raise ValueError(f'Invalid public source path: {name}')
        files[name] = source
    return files


def scan_public(files):
    """Privacy tripwires, alongside a required independent secret scanner at release."""
    check_benchmark_boundary({name: path.read_bytes() for name, path in files.items()})
    failures = []
    home = re.compile(r'/(?:Users|home)/([^/\s\x22\x27`]+)')
    # Deliberate generic fixtures; no developer-specific username is allowlisted.
    generic_users = {'a', 'me', 'test', 'tester', 'user', 'example'}
    private_key = re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----')
    token = re.compile(r'\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|AKIA[0-9A-Z]{16})\b')
    for name, path in files.items():
        try:
            lines = path.read_text(encoding='utf-8').splitlines()
        except UnicodeDecodeError:
            failures.append(f'{name}: unreviewed binary source'); continue
        for number, line in enumerate(lines, 1):
            if any(m[1] not in generic_users for m in home.finditer(line)):
                failures.append(f'{name}:{number}: personal home path')
            if private_key.search(line) or token.search(line):
                failures.append(f'{name}:{number}: potential secret (value withheld)')
    if failures:
        raise ValueError('Public-source privacy check failed:\n' + '\n'.join(failures))
    # Test sources deliberately contain synthetic module strings; execution checks
    # their real imports. Runtime closure is checked independently by bundle.metadata.
    check_imports(files, sources={name: path for name, path in files.items()
                                if '/test/' not in name and '.test.' not in name})
    check_documents(files)


def scan_history(root):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(root), *args])
    # Commit email is an author's preference, not a content/privacy gate. Scan
    # all reachable blobs equally on PRs, main pushes and source exports.
    # Publication carries deleted files too. Inspect every reachable text blob.
    for entry in git('rev-list', '--objects', '--all').decode().splitlines():
        sha, _, name = entry.partition(' ')
        if git('cat-file', '-t', sha).strip() != b'blob':
            continue
        data = git('cat-file', 'blob', sha)
        if re.search(rb'/(?:Users|home)/(?!a[/\x22\x27]|me[/\x22\x27]|test[/\x22\x27]|tester[/\x22\x27]|user[/\x22\x27]|example[/\x22\x27])[^/\s\x22\x27`]+', data):
            raise ValueError(f'Personal path in reachable history blob: {name}; value withheld')


def export(destination, *, author_name, author_email, root=ROOT):
    destination = Path(destination).expanduser().absolute()
    if destination.resolve().is_relative_to(root.resolve()):
        raise ValueError('Export outside the private source checkout')
    if not author_name.strip() or any(c in author_name for c in '\r\n') or not re.fullmatch(r'[^@\s<>]+@[^@\s<>]+', author_email):
        raise ValueError('Use an explicit public author name and valid commit email; GitHub noreply is optional')
    files = public_files(root)
    scan_public(files)
    destination.mkdir(parents=True, exist_ok=False)
    for name, source in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    def git(*args):
        identity = {'GIT_AUTHOR_NAME': author_name, 'GIT_AUTHOR_EMAIL': author_email,
                    'GIT_COMMITTER_NAME': author_name, 'GIT_COMMITTER_EMAIL': author_email}
        return subprocess.check_output(['git', '-C', str(destination), *args],
                                       env={**os.environ, **identity}, text=True, stderr=subprocess.PIPE).strip()
    git('init', '-b', 'main')
    git('config', 'user.name', author_name)
    git('config', 'user.email', author_email)
    git('config', 'commit.gpgsign', 'false')
    git('config', 'core.hooksPath', '/dev/null')
    git('add', '--all')
    git('commit', '-m', 'Prepare Aaron Skills v0.1.0')
    scan_history(destination)
    hashes = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()}
    return {'version': '0.1.0', 'revision': git('rev-parse', 'HEAD'), 'files': hashes,
            'commits': int(git('rev-list', '--count', 'HEAD')), 'remotes': git('remote'),
            'published': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--author-name', required=True)
    parser.add_argument('--author-email', required=True)
    args = parser.parse_args()
    result = export(args.out, author_name=args.author_name, author_email=args.author_email)
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(f'release: {error}')
