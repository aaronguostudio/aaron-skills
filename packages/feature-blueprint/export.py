#!/usr/bin/env python3
"""Export only the allowlisted Feature Blueprint skill and fictional example."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]


def export(destination, root=ROOT):
    root = Path(root).resolve()
    destination = Path(destination).expanduser().absolute()
    if destination.resolve().is_relative_to(root):
        raise ValueError('Export outside the checkout into a new directory.')
    spec = json.loads((root / 'bundles/feature-blueprint.json').read_text(encoding='utf-8'))
    files = {}
    for name in spec['files']:
        path = PurePosixPath(name)
        source = root / name
        if (not name or ':' in name or '\\' in name or path.is_absolute() or '..' in path.parts
                or name != str(path) or name in files or source.is_symlink()
                or not source.is_file() or not source.resolve().is_relative_to(root)):
            raise ValueError('Invalid bundle path')
        files[name] = source
    destination.mkdir(parents=True, exist_ok=False)
    hashes = {}
    for name, source in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        hashes[name] = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest = {'schema': 1, 'bundle': 'feature-blueprint', 'version': spec['version'], 'files': hashes}
    (destination / 'feature-blueprint-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    try:
        result = export(args.out)
        print(f'Exported {len(result["files"])} files; Feature Blueprint {result["version"]}. No registration or publishing performed.')
    except (OSError, ValueError) as error:
        sys.exit(f'blueprint-export: {error}')
