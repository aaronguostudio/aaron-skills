#!/usr/bin/env python3
"""Install and exercise a first-use journey without the developer's home/config."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))
from workspace import require_external
sys.path.insert(0, str(REPO / 'scripts'))
from managed_registration import active_release
from platform_tools import bun_binary
from score import grade


def clean_environment(profile, workspace, ambient=None):
    ambient = os.environ if ambient is None else ambient
    allowed = {'PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'ComSpec', 'PATHEXT',
               'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'PROCESSOR_ARCHITECTURE',
               'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'}
    env = {key: value for key, value in ambient.items() if key in allowed}
    # These values describe a child process's real isolated user profile. The
    # parent shell/user environment is never changed.
    env.update(HOME=str(profile), USERPROFILE=str(profile),
               APPDATA=str(profile / 'AppData/Roaming'), LOCALAPPDATA=str(profile / 'AppData/Local'),
               XDG_CONFIG_HOME=str(profile / '.config'), XDG_CACHE_HOME=str(profile / '.cache'),
               npm_config_cache=str(profile / '.npm'), PYTHONNOUSERSITE='1', PYTHONUTF8='1',
               AARON_SKILLS_NO_UPDATE='1', DEMO_CAPTURE_HOME=str(workspace / 'sessions'),
               AARON_DEMO_VOICE_PROFILES=str(profile / '.config/aaron-skills/demo/voice-profiles.json'))
    return env


def run(workspace):
    workspace = require_external(workspace)
    workspace.mkdir(parents=True, exist_ok=False)
    profile = workspace / 'profile'
    profile.mkdir()
    env = clean_environment(profile, workspace)
    for name in ('APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME'):
        Path(env[name]).mkdir(parents=True, exist_ok=True)
    report = {'schema': 1, 'case': 'onboarding-v0', 'protocolVersion': 1,
              'providerEvidence': 'synthetic-loopback-only', 'humanAcceptance': 'not-assessed',
              'nativeAgent': 'not-assessed', 'prerequisiteScope': 'Tools provisioned; fresh application/user profile',
              'stages': [], 'isolation': {'ambientVoiceCredentials': 'removed', 'developerConfig': 'not-copied'}}
    revision = subprocess.run(['git', '-C', str(REPO), 'rev-parse', 'HEAD'], capture_output=True, text=True)
    report.update(sourceRevision=revision.stdout.strip() if revision.returncode == 0 else 'exported-source',
                  protocolHashes={name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in ('case.json', 'tasks.md', 'rubric.json', 'journey.ts', 'run.py', 'score.py')})
    started = time.monotonic()
    def persist():
        report['elapsedSeconds'] = round(time.monotonic() - started, 2)
        report['grade'] = grade(report)
        (workspace / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    def command(name, argv, *, environment=env, success=True):
        with (workspace / (name + '.log')).open('w', encoding='utf-8') as log:
            result = subprocess.run([str(a) for a in argv], cwd=REPO, env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=900)
        if (result.returncode == 0) != success:
            # All inputs/credentials in this runner are synthetic; retain the
            # complete log externally and expose a short failure tail to CI.
            print((workspace / (name + '.log')).read_text(encoding='utf-8', errors='replace')[-2500:], file=sys.stderr)
            raise ValueError(f'{name} failed its exit-code contract; inspect the external stage log')
        return (workspace / (name + '.log')).read_text(encoding='utf-8', errors='replace')
    def stage(name, action):
        at = time.monotonic()
        try:
            detail = action()
            report['stages'].append({'id': name, 'status': 'passed', 'seconds': round(time.monotonic() - at, 2), 'detail': detail})
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            report['stages'].append({'id': name, 'status': 'failed', 'seconds': round(time.monotonic() - at, 2), 'failureType': type(error).__name__})
            persist()
            raise
        persist()
    def missing():
        text = command('missing-prerequisites', [sys.executable, REPO / 'scripts/install.py', '--root', workspace / 'must-not-install'],
                       environment={**env, 'PATH': ''}, success=False)
        if 'Missing prerequisites' not in text or (workspace / 'must-not-install').exists():
            raise ValueError('Missing tools must produce guidance before writing an installation')
        return 'Missing tools refused without system changes'
    stage('missing-prerequisite-guidance', missing)
    options = ['--agent', 'codex', '--root', workspace / 'runtime', '--skills-dir', workspace / 'skills', '--bin-dir', workspace / 'bin']
    setup = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', REPO / 'scripts/setup.ps1'] if os.name == 'nt' else ['bash', REPO / 'scripts/setup.sh']
    stage('fresh-install', lambda: bool(command('install', [*setup, *options])))
    release = active_release(workspace / 'runtime') if os.name == 'nt' else (workspace / 'runtime/current').resolve()
    manifest = json.loads((release / 'bundle-manifest.json').read_text(encoding='utf-8'))
    report.update(bundleId=manifest['id'], sourceRevision=manifest['sourceRevision'], version=manifest['version'])
    persist()
    try:
        command('journey', [bun_binary(release / 'packages/demo/remotion'), HERE / 'journey.ts', release, workspace])
    finally:
        journey = workspace / 'journey.json'
        if journey.is_file():
            detail = json.loads(journey.read_text(encoding='utf-8'))
            report['stages'].extend(detail.pop('stages'))
            report.update(detail)
        persist()
    print(json.dumps(report['grade'], indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True, help='A new empty directory outside every Git checkout')
    args = parser.parse_args()
    try:
        raise SystemExit(int(not run(args.workspace)['grade']['passed']))
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f'onboarding: {error}\n')
