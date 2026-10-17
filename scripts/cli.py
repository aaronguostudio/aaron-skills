#!/usr/bin/env python3
"""Commands for the installed demo-only bundle."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'packages/demo/capture'
RENDER = ROOT / 'packages/demo/remotion'

def settings():
    return json.loads((ROOT / 'installed.json').read_text())

def environment(config):
    env = dict(os.environ)
    # Desktop apps may have an older PATH than Terminal. Use the tools checked at install time.
    directories = [str(Path(value).parent) for value in config['tools'].values()]
    env['PATH'] = os.pathsep.join(dict.fromkeys(directories + [env.get('PATH', '')]))
    env['PLAYWRIGHT_BROWSERS_PATH'] = config['playwrightBrowsers']
    return env

def run(command, config, **kwargs):
    return subprocess.run([str(part) for part in command], env=environment(config), **kwargs)

def doctor(config, check_links=True):
    failures = []
    def check(label, command, **kwargs):
        result = run(command, config, capture_output=True, text=True, **kwargs)
        print(f'{"PASS" if result.returncode == 0 else "FAIL"} {label}', flush=True)
        if result.returncode:
            failures.append(label)
            print((result.stderr or result.stdout)[-2000:])
    manifest = json.loads((ROOT / 'bundle-manifest.json').read_text())
    for relative, expected in manifest['files'].items():
        path = ROOT / relative
        if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            failures.append(f'Bundle file changed or missing: {relative}')
    check('Node >=22', [config['tools']['node'], '-e', 'if(+process.versions.node.split(".")[0]<22)process.exit(1)'])
    check('Python + Pillow', [ROOT / '.venv/bin/python3', '-c', 'from PIL import Image'])
    for name in ('ffmpeg', 'ffprobe'):
        check(name, [config['tools'][name], '-version'])
    check('Pinned Bun', [RENDER / 'node_modules/.bin/bun', '--version'])
    check('Walkthrough entry loads', [RENDER / 'node_modules/.bin/bun', '-e', "await import('../walkthrough/render-walkthrough.ts')"], cwd=RENDER)
    check('Headed Chromium installed + headless Chromium launches', [config['tools']['node'], '--input-type=module', '-e',
        "import {chromium} from 'playwright';import {existsSync} from 'node:fs';"
        "if(!existsSync(chromium.executablePath()))throw Error('Headed Chromium is missing');"
        "const b=await chromium.launch();await b.close()"], cwd=ENGINE)
    check('Remotion browser', [config['tools']['node'], RENDER / 'node_modules/@remotion/cli/remotion-cli.js', 'browser', 'ensure'], cwd=RENDER)
    if check_links:
        for directory in config.get('skillsDirs', [config['skillsDir']]):
            for name in manifest['skills']:
                path = Path(directory) / name
                if not path.is_symlink() or path.resolve() != (ROOT / 'skills' / name).resolve():
                    failures.append(f'Skill link: {path}')
        executable = Path(config['binDir']) / 'aaron-demo'
        if not executable.is_symlink() or executable.resolve() != (ROOT / 'aaron-demo').resolve():
            failures.append(f'Command link: {executable}')
    for failure in failures:
        print(f'FAIL {failure}', file=sys.stderr)
    if not failures:
        state = ', modified source' if manifest.get('sourceDirty') else ''
        print(f'Demo tools ready: {manifest["id"]} (source {manifest["sourceRevision"]}{state})')
    return bool(failures)

def main():
    os.umask(0o077)
    args = sys.argv[1:]
    if not args or args[0] in ('--help', '-h'):
        print('Usage: aaron-demo doctor | smoke | uninstall | docs [topic] | capture <args> | inspect <run> | render <run> [args] | revise <run> <patch.json> --out <new-run> | page <message.md> --out <page.html> | mark <args>')
        return 0
    if args[0] == 'docs':
        topic = args[1] if len(args) > 1 else 'first-demo'
        documents = {path.stem: path for path in (ROOT / 'docs').glob('*.md')}
        if topic not in documents:
            print('Available topics: ' + ', '.join(sorted(documents)), file=sys.stderr)
            return 2
        print(documents[topic].read_text())
        return 0
    config = settings()
    command, rest = args[0], args[1:]
    if command == 'uninstall':
        return run([config['tools']['python'], ROOT / 'scripts/install.py', '--root', ROOT.parent.parent, '--uninstall'], config).returncode
    if command == 'doctor':
        return doctor(config)
    commands = {
        'capture': [config['tools']['node'], ENGINE / 'scripts/cli.mjs'],
        'render': [RENDER / 'node_modules/.bin/bun', ROOT / 'packages/demo/walkthrough/render-walkthrough.ts'],
        'revise': [ROOT / '.venv/bin/python3', ROOT / 'scripts/revise_capture.py'],
        'inspect': [ROOT / '.venv/bin/python3', ROOT / 'scripts/capture_view.py'],
        'page': [ROOT / '.venv/bin/python3', ROOT / 'packages/demo/update/scripts/build_page.py'],
        'mark': [ROOT / '.venv/bin/python3', ROOT / 'packages/demo/update/scripts/mark_screenshot.py'],
        'smoke': [config['tools']['node'], ROOT / 'scripts/smoke.mjs'],
    }
    if command not in commands:
        print(f'Unknown command: {command}', file=sys.stderr)
        return 2
    return run(commands[command] + rest, config).returncode

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'aaron-demo: {error}', file=sys.stderr)
        sys.exit(1)
