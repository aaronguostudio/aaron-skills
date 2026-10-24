#!/usr/bin/env python3
"""Prepare checksum-bound update assets from a clean, versioned source checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile

from bundle import ROOT, build, metadata
from updates import DESCRIPTOR, policy_metadata, version_tuple, write_json


def prepare(output, *, root=ROOT, tag=None):
    manifest = metadata(root)
    version_tuple(manifest['version'])
    policy_metadata(manifest.get('update'))
    if manifest['sourceDirty'] or manifest['sourceRevision'] == 'local-uncommitted':
        raise ValueError('Update assets require clean committed bundle sources')
    if tag is not None and tag != 'v' + manifest['version']:
        raise ValueError('Release tag must match the bundle version')
    output = output.resolve()
    if output.is_relative_to(root.resolve()):
        raise ValueError('Prepare update assets outside the checkout')
    output.mkdir(parents=True, exist_ok=False)
    archive = output / f'aaron-skills-demo-{manifest["version"]}.tar.gz'
    with tempfile.TemporaryDirectory(prefix='aaron-skills-release-') as temporary:
        exported = Path(temporary) / 'bundle'
        build(exported, root=root)
        with tarfile.open(archive, 'w:gz') as tar:
            for name in sorted([*manifest['files'], 'bundle-manifest.json']):
                tar.add(exported / name, arcname=name, recursive=False)
    descriptor = {key: manifest[key] for key in ('version', 'sourceRevision', 'id', 'update')}
    descriptor.update(schema=1, sha256=hashlib.sha256(archive.read_bytes()).hexdigest())
    write_json(output / DESCRIPTOR, descriptor)
    return descriptor


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--tag')
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.out, tag=args.tag), indent=2))
    except (OSError, ValueError) as error:
        parser.exit(1, f'prepare-update: {error}\n')
