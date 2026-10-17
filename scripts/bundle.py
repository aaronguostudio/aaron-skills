#!/usr/bin/env python3
"""Export the Demo bundle from an explicit file manifest, without customer data."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SKILLS = tuple(json.loads((ROOT / 'bundles/demo.json').read_text(encoding='utf-8'))['skills'])


def bundle_files(root=ROOT):
    manifest = json.loads((root / 'bundles/demo.json').read_text(encoding='utf-8'))
    files = {}
    for relative in manifest['files']:
        path = Path(relative)
        if path.is_absolute() or '..' in path.parts or relative in files:
            raise ValueError(f'Invalid or duplicate bundle path: {relative}')
        files[relative] = root / path
    return files


def check_imports(files):
    """Check relative module closure in the exported set, including TS type imports."""
    import posixpath
    missing = []
    for relative, source in files.items():
        if source.suffix not in ('.ts', '.tsx', '.mjs'):
            continue
        for ref in re.findall(r'''(?:from\s*|import\s*)["'](\.[^"']+)["']''', source.read_text(encoding='utf-8')):
            target = posixpath.normpath(str(PurePosixPath(relative).parent / ref))
            candidates = [target, *(target + ext for ext in ('.ts', '.tsx', '.mjs', '.json')), target + '/index.ts', target + '/index.tsx']
            if not any(candidate in files for candidate in candidates):
                missing.append(f'{relative}: {ref}')
    if missing:
        raise ValueError('Missing bundled imports:\n' + '\n'.join(missing))


def check_documents(files):
    """Validate real Markdown references, ignoring examples inside fenced blocks."""
    import posixpath
    missing = []
    for relative, source in files.items():
        if source.suffix != '.md':
            continue
        fence = None
        for line in source.read_text(encoding='utf-8').splitlines():
            marker = re.match(r'^\s*(`{3,}|~{3,})', line)
            if marker:
                token = marker[1][0]
                fence = None if fence == token else token if fence is None else fence
                continue
            if fence:
                continue
            for ref in re.findall(r'\]\(([^)\s]+)\)', line):
                if re.match(r'^[a-z][a-z0-9+.-]*:', ref, re.I) or ref.startswith('#'):
                    continue
                target = posixpath.normpath(str(PurePosixPath(relative).parent / ref.split('#')[0]))
                if target not in files:
                    missing.append(f'{relative}: {ref}')
            for topic in re.findall(r'aaron-demo docs ([a-z][a-z-]*)', line):
                if f'docs/{topic}.md' not in files:
                    missing.append(f'{relative}: missing CLI docs topic {topic}')
    if missing:
        raise ValueError('Missing bundled documents:\n' + '\n'.join(missing))


def metadata(root=ROOT):
    files = bundle_files(root)
    hashes = {}
    for destination, source in sorted(files.items()):
        if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(root.resolve()):
            raise ValueError(f'Missing or symlinked bundle source: {source}')
        hashes[destination] = hashlib.sha256(source.read_bytes()).hexdigest()
    check_imports(files)
    check_documents(files)
    digest = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
    try:
        revision = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True, stderr=subprocess.DEVNULL).strip()
        dirty = bool(subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain', '--', *files], text=True).strip())
    except subprocess.CalledProcessError:
        original = root / 'bundle-manifest.json'
        previous = json.loads(original.read_text(encoding='utf-8')) if original.is_file() else {}
        revision = previous.get('sourceRevision', 'local-uncommitted')
        dirty = previous.get('sourceDirty', True) or previous.get('files') != hashes
    return {'schema': 1, 'bundle': 'demo', 'version': json.loads((root / 'bundles/demo.json').read_text(encoding='utf-8'))['version'], 'id': digest[:16],
            'sourceRevision': revision, 'sourceDirty': dirty, 'skills': list(SKILLS), 'files': hashes}


def build(destination, root=ROOT):
    destination = Path(destination).expanduser().absolute()
    if destination.resolve().is_relative_to(root.resolve()):
        raise ValueError('Export outside the source checkout.')
    manifest = metadata(root)
    destination.mkdir(parents=True, exist_ok=False)
    for relative, source in bundle_files(root).items():
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    (destination / 'scripts/cli.py').chmod(0o755)
    (destination / 'bundle-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    try:
        manifest = build(args.out)
        print(f'Exported {len(manifest["files"])} files, bundle {manifest["id"]}, source {manifest["sourceRevision"]}')
    except (ValueError, OSError) as error:
        parser.exit(1, f'bundle: {error}\n')
