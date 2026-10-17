#!/usr/bin/env python3
"""Create a presentation-only capture derivative; never open or replay the application."""
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
from capture_view import target_focus, validate_coverage
from platform_tools import private_path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def revise(source, patch_path, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or source in output.parents or output in source.parents:
        raise ValueError('Revision and source folders must not overlap')
    if any((parent / '.git').exists() for parent in (output, *output.parents)):
        raise ValueError('Revision output must stay outside Git repositories')
    if output.exists():
        raise ValueError('Revision output must be a new folder')
    patch = json.loads(Path(patch_path).read_text(encoding='utf-8'))
    if not isinstance(patch, dict) or set(patch) != {'steps'} or not isinstance(patch['steps'], dict) or not patch['steps']:
        raise ValueError('Patch must contain only a nonempty steps object keyed by step id')

    def asset(relative):
        if not isinstance(relative, str) or '\\' in relative:
            raise ValueError('Invalid capture asset path')
        path = PurePosixPath(relative)
        if path.is_absolute() or PureWindowsPath(relative).drive or '..' in path.parts or not path.parts:
            raise ValueError('Capture assets must stay inside the source folder')
        candidate = source.joinpath(*path.parts)
        if not candidate.is_file() or candidate.is_symlink() or candidate.resolve() != candidate:
            raise ValueError('Capture assets must be regular files without symlink parents')
        return candidate

    capture = json.loads(asset('capture.json').read_text(encoding='utf-8'))
    steps = json.loads(asset('steps.json').read_text(encoding='utf-8'))
    if capture.get('version') != 1 or capture.get('status') != 'passed':
        raise ValueError('Only passed contract-1 captures can be revised')
    viewport = capture.get('viewport', {})
    w, h = viewport.get('w'), viewport.get('h')
    if not all(number(n) and n > 0 and n % 2 == 0 for n in (w, h)):
        raise ValueError('Invalid capture viewport')
    if not isinstance(steps, list) or not steps:
        raise ValueError('Capture needs steps')
    ids = [s.get('id') for s in steps]
    if not all(isinstance(s, str) and s for s in ids) or len(set(ids)) != len(ids):
        raise ValueError('Capture needs unique step ids')
    if set(patch['steps']) - set(ids):
        raise ValueError('Patch names an unknown step')
    originals = ['capture.json', 'steps.json', 'video.webm']
    if (source / 'revision.json').exists():
        originals.append('revision.json')
    for step in steps:
        if step.get('shot') is not None:
            originals.append(step['shot'])
        change = patch['steps'].get(step['id'])
        if change is None:
            if step['id'] in patch['steps']:
                raise ValueError('Step changes must be objects')
            continue
        if not isinstance(change, dict) or not change or set(change) - {'caption', 'focus', 'focusTargets'}:
            raise ValueError('Only caption and focus/focusTargets may change; timings, clicks and evidence are immutable')
        if 'focusTargets' in change:
            if 'focus' in change:
                raise ValueError('Use focusTargets or explicit focus, not both')
            change = {**change, 'focus': target_focus(step, change['focusTargets'], viewport)}
            del change['focusTargets']
        if 'caption' in change and (not isinstance(change['caption'], str) or not change['caption'].strip()):
            raise ValueError('Caption must be nonempty text')
        if 'focus' in change:
            if not isinstance(change['focus'], list):
                raise ValueError('Focus must be an array; [] clears it')
            for focus in change['focus']:
                if not isinstance(focus, dict) or set(focus) != {'box', 'fromMs', 'toMs'}:
                    raise ValueError('Focus needs box, fromMs and toMs')
                box = focus['box']
                if isinstance(box, list) and len(box) == 4:
                    box = dict(zip(('x', 'y', 'w', 'h'), box))
                if not isinstance(box, dict) or set(box) != {'x', 'y', 'w', 'h'} or not all(number(n) for n in box.values()):
                    raise ValueError('Focus box must contain finite x,y,w,h')
                if not (box['x'] >= 0 and box['y'] >= 0 and box['w'] > 0 and box['h'] > 0 and box['x'] + box['w'] <= w and box['y'] + box['h'] <= h):
                    raise ValueError('Focus box must stay inside the viewport')
                a, b = focus['fromMs'], focus['toMs']
                if not (number(a) and number(b) and step['startMs'] <= a <= b <= step['endMs']):
                    raise ValueError('Focus times must stay inside the original step')
        step.update(change)
    for step in steps:
        validate_coverage(step, viewport)
    # Validate and hash every required input before creating output. Copy bytes, never hardlink.
    files = {name: asset(name) for name in set(originals)}
    hashes = {name: digest(path) for name, path in files.items()}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    try:
        private_path(output, directory=True)
        for name, path in files.items():
            if name == 'revision.json':
                continue  # parent provenance is retained by hash in this revision's manifest
            dest = output / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, dest)
            private_path(dest)
            if digest(dest) != hashes[name]:
                raise ValueError('Source changed while copying; no revision retained')
        (output / 'steps.json').write_text(json.dumps(steps, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        if any(digest(path) != hashes[name] for name, path in files.items()):
            raise ValueError('Source changed during revision; no revision retained')
        manifest = {'version': 1, 'kind': 'presentation-only', 'source': str(source),
                    'sourceHashes': hashes, 'patch': patch,
                    'derivedStepsSha256': digest(output / 'steps.json'), 'businessAssertionsReplayed': False}
        (output / 'revision.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        for path in (output / 'steps.json', output / 'revision.json'):
            private_path(path)
    except BaseException:
        shutil.rmtree(output)
        raise
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('patch', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    try:
        revise(args.source, args.patch, args.out)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, f'aaron-demo revise: {error}\n')
    print(f'Presentation revision: {args.out.resolve()} (source retained; no business flow replayed)')


if __name__ == '__main__':
    main()
