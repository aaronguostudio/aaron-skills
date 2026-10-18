#!/usr/bin/env python3
"""Collect file-level evidence without launching a browser or assigning visual scores."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from workspace import require_external


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def media_info(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                             'format=duration:stream=codec_type,codec_name,width,height',
                             '-of', 'json', str(path)], capture_output=True, text=True)
    info = json.loads(result.stdout) if result.returncode == 0 else {}
    decode = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'],
                            capture_output=True, text=True)
    return {'probeSucceeded': result.returncode == 0, 'fullDecodeSucceeded': decode.returncode == 0,
            'durationSeconds': float(info.get('format', {}).get('duration', 0)),
            'streams': info.get('streams', [])}


def collect(trial):
    evidence = json.loads((trial / 'execution.json').read_text())
    files = []
    captures = []
    revisions = []
    for path in sorted(trial.rglob('*')):
        if not path.is_file() or path.is_symlink() or '.agents' in path.parts:
            continue
        relative = path.relative_to(trial).as_posix()
        if path.name in {'events.jsonl', 'stderr.log', 'prompt.txt', 'final.txt', 'execution.json'}:
            continue
        if 'capture-state' in path.parts and 'runs' not in path.parts:
            continue  # Never export session material, including public no-login sessions.
        item = {'path': relative, 'bytes': path.stat().st_size, 'sha256': digest(path)}
        if path.suffix == '.mp4':
            item['media'] = media_info(path)
        files.append(item)
        if path.name == 'capture.json':
            data = json.loads(path.read_text())
            captures.append({'path': relative, 'status': data.get('status'),
                             'failedStep': data.get('failedStep'), 'failure': data.get('failure'),
                             'startedAt': data.get('startedAt'), 'appRevision': data.get('appRevision')})
        if path.name == 'revision.json':
            data = json.loads(path.read_text())
            # The source path is local metadata and must not enter a public report.
            revisions.append({'path': relative, 'sha256': digest(path), 'fields': sorted(data)})
    evidence.update(artifactManifest=files, captures=captures, revisions=revisions)
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trial', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    require_external(args.trial)
    require_external(args.out)
    if args.out.exists():
        parser.error('Keep prior evidence; select a new output filename.')
    args.out.write_text(json.dumps(collect(args.trial.resolve()), indent=2, ensure_ascii=False) + '\n')
    print('Collected file/decode evidence. Browser, visual, editorial and safety review are separate.')


if __name__ == '__main__':
    main()
