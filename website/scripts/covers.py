#!/usr/bin/env python3
"""Maintain the cover library: masters in a release asset store, derivatives in Git.

The byte-preserved PNG masters are too large to keep in the tree: every plugin
install shallow-clones this repository, so 32 masters cost every user ~54 MB for
files only the website's download link and this script ever read. They live in
the `cover-originals` pre-release instead, and `sync` moves them both ways.

The renderer never reads them. Film bundles its own WebP copies under
`packages/demo/covers/art/`; nothing here changes what a rendered video uses.

Usage:
    covers.py sync [--prune]       reconcile masters, derivatives and covers.json
    covers.py add <png> --id ...   add a cover, writing its catalogue entry
    covers.py remove <id>          drop a cover from the catalogue and the store
    covers.py verify [--offline]   report inconsistencies without changing anything
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'aaronguostudio/aaron-skills'
TAG = 'cover-originals'
DOWNLOAD = f'https://github.com/{REPOSITORY}/releases/download/{TAG}/'
# Kept out of Git: masters are restored from the release on demand.
MASTERS = ROOT / '.covers-masters'
CATALOG = ROOT / 'cover-library.json'
PREVIEWS = ROOT / 'public/covers/previews'
DELIVERY = ROOT / 'src/covers.json'
FAMILIES = 8
PER_FAMILY = 4


def gh(*args, capture=True):
    """Call the GitHub CLI. Every network operation goes through here."""
    command = ['gh', *args, '--repo', REPOSITORY]
    try:
        if capture:
            return subprocess.check_output(command, text=True, stderr=subprocess.PIPE)
        subprocess.run(command, check=True)
        return ''
    except FileNotFoundError:
        raise ValueError('The GitHub CLI (gh) is required for master storage. See COVER-LIBRARY.md.')
    except subprocess.CalledProcessError as error:
        raise ValueError(f'gh {" ".join(args)} failed: {(error.stderr or "").strip()[:400]}')


def stored_assets():
    """Master file name -> size, as the release currently holds them."""
    data = json.loads(gh('release', 'view', TAG, '--json', 'assets'))
    return {asset['name']: asset['size'] for asset in data.get('assets', []) if asset['name'].endswith('.png')}


def catalog_entries():
    data = json.loads(CATALOG.read_text(encoding='utf-8'))
    ids = [entry['id'] for entry in data['covers']]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate cover id in cover-library.json')
    return data


def master_path(cover_id):
    return MASTERS / f'{cover_id}.png'


def restore(cover_id):
    """Pull one master from the release so a fresh clone can rebuild derivatives."""
    MASTERS.mkdir(parents=True, exist_ok=True)
    gh('release', 'download', TAG, '--pattern', f'{cover_id}.png', '--dir', str(MASTERS), '--clobber', capture=False)
    if not master_path(cover_id).is_file():
        raise ValueError(f'{cover_id}: the release has no master to restore')


def publish(cover_id):
    gh('release', 'upload', TAG, str(master_path(cover_id)), '--clobber', capture=False)


def build_derivatives(entry):
    """Write the two WebP previews and return the delivery record for covers.json."""
    from PIL import Image
    original = master_path(entry['id'])
    data = original.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    with Image.open(original) as image:
        image = image.convert('RGB')
        width, height = image.size
        for size, suffix, quality in [(width, '', 88), (640, '-640', 82)]:
            preview = image.copy()
            if size < width:
                preview.thumbnail((size, round(size * height / width)), Image.Resampling.LANCZOS)
            preview.save(PREVIEWS / (entry['id'] + suffix + '.webp'), 'WEBP', quality=quality, method=6)
    base = '/covers/previews/' + entry['id']
    full, thumb = PREVIEWS / (entry['id'] + '.webp'), PREVIEWS / (entry['id'] + '-640.webp')
    return {**{key: entry[key] for key in ['id', 'title', 'family', 'familyTitle', 'description']},
            'width': width, 'height': height, 'png': DOWNLOAD + original.name,
            'webp': base + '.webp', 'thumbnail': base + '-640.webp', 'sha256': digest,
            'bytes': {'png': len(data), 'webp': full.stat().st_size, 'thumbnail': thumb.stat().st_size}}


def sync(prune=False):
    data = catalog_entries()
    wanted = {entry['id'] for entry in data['covers']}
    stored = stored_assets()
    restored, published, orphans = [], [], sorted(name[:-4] for name in stored if name[:-4] not in wanted)

    for entry in data['covers']:
        if not master_path(entry['id']).is_file():
            restore(entry['id'])
            restored.append(entry['id'])
        elif f"{entry['id']}.png" not in stored or stored[f"{entry['id']}.png"] != master_path(entry['id']).stat().st_size:
            publish(entry['id'])
            published.append(entry['id'])

    delivery = [build_derivatives(entry) for entry in data['covers']]
    DELIVERY.write_text(json.dumps(delivery, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    removed = []
    for name in sorted(path.name for path in PREVIEWS.glob('*.webp')):
        if name.removesuffix('.webp').removesuffix('-640') not in wanted:
            (PREVIEWS / name).unlink()
            removed.append(name)

    for line, items in [('Restored from the release', restored), ('Uploaded to the release', published),
                        ('Deleted stale previews', removed)]:
        if items:
            print(f'{line}: {", ".join(items)}')
    if orphans:
        if prune:
            for cover_id in orphans:
                gh('release', 'delete-asset', TAG, f'{cover_id}.png', '--yes', capture=False)
            print(f'Pruned release masters: {", ".join(orphans)}')
        else:
            print(f'Release masters not in the catalogue (use --prune to delete): {", ".join(orphans)}')
    print(f'Prepared {len(delivery)} covers. Commit the previews and covers.json; masters stay out of Git.')


def add(args):
    source = Path(args.png).expanduser().resolve()
    if source.suffix.lower() != '.png':
        raise ValueError('A master must be a PNG')
    data = catalog_entries()
    if any(entry['id'] == args.id for entry in data['covers']):
        raise ValueError(f'{args.id} is already in the catalogue; use sync to refresh it')
    MASTERS.mkdir(parents=True, exist_ok=True)
    master_path(args.id).write_bytes(source.read_bytes())
    data['covers'].append({'id': args.id, 'title': {'en': args.title_en, 'zh': args.title_zh},
                           'family': args.family, 'familyTitle': {'en': args.family_title_en, 'zh': args.family_title_zh},
                           'prompt': args.prompt, 'description': {'en': args.description_en, 'zh': args.description_zh}})
    CATALOG.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Added {args.id} to the catalogue.')
    sync()


def remove(cover_id, prune=True):
    data = catalog_entries()
    if not any(entry['id'] == cover_id for entry in data['covers']):
        raise ValueError(f'{cover_id} is not in the catalogue')
    data['covers'] = [entry for entry in data['covers'] if entry['id'] != cover_id]
    CATALOG.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    master_path(cover_id).unlink(missing_ok=True)
    print(f'Removed {cover_id} from the catalogue.')
    sync(prune=prune)


def verify(offline=False):
    """Report drift without changing anything. Offline skips every network call."""
    data, problems = catalog_entries(), []
    delivery = {record['id']: record for record in json.loads(DELIVERY.read_text(encoding='utf-8'))}
    wanted = [entry['id'] for entry in data['covers']]
    if set(delivery) != set(wanted):
        problems.append(f'covers.json ids differ from the catalogue: {sorted(set(delivery) ^ set(wanted))}')
    families = {}
    for cover_id in wanted:
        record = delivery.get(cover_id)
        if record is None:
            continue
        families[record['family']] = families.get(record['family'], 0) + 1
        if not record['png'].startswith(DOWNLOAD):
            problems.append(f'{cover_id}: png does not point at the release asset store')
        for key in ('webp', 'thumbnail'):
            path = ROOT / 'public' / record[key].lstrip('/')
            if not path.is_file():
                problems.append(f'{cover_id}: missing {key} derivative')
            elif path.stat().st_size != record['bytes'][key]:
                problems.append(f'{cover_id}: {key} size differs from covers.json')
    if len(families) != FAMILIES or any(count != PER_FAMILY for count in families.values()):
        problems.append(f'Expected {FAMILIES} families of {PER_FAMILY}; found {families}')
    if not offline:
        stored = stored_assets()
        for cover_id in wanted:
            record, name = delivery.get(cover_id), f'{cover_id}.png'
            if name not in stored:
                problems.append(f'{cover_id}: no master in the {TAG} release')
            elif record and stored[name] != record['bytes']['png']:
                problems.append(f'{cover_id}: release master is {stored[name]} bytes, covers.json says {record["bytes"]["png"]}')
        for name in sorted(stored):
            if name[:-4] not in wanted:
                problems.append(f'{name}: release master is not in the catalogue')
    for problem in problems:
        print(f'FAIL {problem}', file=sys.stderr)
    if problems:
        return 1
    print(f'{len(wanted)} covers consistent across catalogue and derivatives'
          + ('' if offline else f' and the {TAG} release') + '.')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest='command', required=True)
    synchronize = commands.add_parser('sync', help='Reconcile masters, derivatives and covers.json')
    synchronize.set_defaults(run=lambda args: sync(args.prune))
    synchronize.add_argument('--prune', action='store_true', help='Delete release masters no longer in the catalogue')
    creation = commands.add_parser('add', help='Add a cover and write its catalogue entry')
    creation.add_argument('png')
    for name in ('id', 'family', 'title-en', 'title-zh', 'family-title-en', 'family-title-zh',
                 'description-en', 'description-zh', 'prompt'):
        creation.add_argument(f'--{name}', required=True)
    creation.set_defaults(run=add)
    deletion = commands.add_parser('remove', help='Drop a cover from the catalogue and the store')
    deletion.add_argument('id')
    deletion.add_argument('--keep-master', action='store_true', help='Leave the release asset in place')
    deletion.set_defaults(run=lambda args: remove(args.id, prune=not args.keep_master))
    inspection = commands.add_parser('verify', help='Report inconsistencies without changing anything')
    inspection.add_argument('--offline', action='store_true', help='Skip every network call')
    inspection.set_defaults(run=lambda args: verify(args.offline))
    args = parser.parse_args()
    return args.run(args) or 0


if __name__ == '__main__':
    os.umask(0o077)
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'covers: {error}')
