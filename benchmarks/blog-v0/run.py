#!/usr/bin/env python3
"""Run the frozen blog task against an installed Demo bundle; raw outputs stay outside Git."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

HERE = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--trial', type=int, choices=[1, 2, 3], required=True)
    parser.add_argument('--profile', choices=['strict', 'offline'], default='strict')
    args = parser.parse_args()
    root = args.workspace.resolve()
    if (root / '.git').exists() or root.is_relative_to(HERE.parents[1]):
        parser.error('Use an external isolated workspace, never the source repository.')
    trial = root / f'{"offline-" if args.profile == "offline" else ""}trial-{args.trial}'
    trial.mkdir(exist_ok=False)
    project = trial / 'project'
    project.mkdir()
    source = root / 'blog'
    (project / 'application-source').symlink_to(source, target_is_directory=True)
    skills = project / '.agents/skills'
    skills.mkdir(parents=True)
    runtime = (root / 'runtime/current').resolve()
    for name in ['demo-capture', 'walkthrough-video', 'paste-ready-update']:
        (skills / name).symlink_to(runtime / 'skills' / name, target_is_directory=True)
    artifacts = trial / 'artifacts'
    artifacts.mkdir()
    # Content review and application preparation are benchmark setup, not timed agent work.
    brief = (HERE / 'tasks.md').read_text()
    context = (
        f'\nExecution context:\nProject adapter workspace: {project}\n'
        f'Application source (read only): {source}\nLocal origin: http://127.0.0.1:4190\n'
        f'Artifact root: {artifacts}\nInstalled command: {root / "bin/aaron-demo"}\n'
        'Use the installed command, or put its bin directory on PATH. Read each installed SKILL.md. '
        'The application source is a committed snapshot; do not change it. '
        'Do not use a separately launched browser automation script; browser operation belongs '
        'to the Demo capture runtime. View its saved screenshots/stills for review. '
        'The provided local host and read-only demo are authorized. '
        'Do not run another agent. Work to completion within the stated time budget.\n'
    )
    prompt = trial / 'prompt.txt'
    if args.profile == 'offline':
        context += ('\nFixture profile blog-v0-offline-v1: the local response headers prohibit external '
                    'connect requests and third-party iframes. Those non-core features are excluded; '
                    'local search, articles, images and language switching remain the target. '
                    'Keep that fixture policy and do not read/reuse other trial artifacts.\n')
    prompt.write_text(brief + context)
    env = dict(os.environ)
    env['PATH'] = str(root / 'bin') + os.pathsep + env.get('PATH', '')
    env['DEMO_CAPTURE_HOME'] = str(trial / 'capture-state')
    case = json.loads((HERE / 'case.json').read_text())
    command = ['codex', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
               '--model', case['host']['model'], '-c', 'model_reasoning_effort="' + case['host']['reasoningEffort'] + '"',
               '--sandbox', 'danger-full-access', '-c', 'approval_policy="never"',
               '--json', '--output-last-message', str(trial / 'final.txt'), '-']
    protocol = {name: digest(HERE / name) for name in ['case.json', 'tasks.md', 'rubric.json']}
    if args.profile == 'offline':
        protocol['profiles/offline.json'] = digest(HERE / 'profiles/offline.json')
    started = time.time()
    with (trial / 'events.jsonl').open('w') as stdout, (trial / 'stderr.log').open('w') as stderr:
        process = subprocess.Popen(command, cwd=project, env=env, stdin=subprocess.PIPE,
                                   stdout=stdout, stderr=stderr, text=True, start_new_session=True)
        try:
            process.communicate(prompt.read_text(), timeout=1200)
            timed_out = False
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=15)
            timed_out = True
    events = []
    for line in (trial / 'events.jsonl').read_text().splitlines():
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    usage = next((e.get('usage') for e in reversed(events) if e.get('type') == 'turn.completed'), None)
    commands = [e['item'] for e in events if e.get('type') == 'item.completed'
                and e.get('item', {}).get('type') == 'command_execution']
    result = {'trial': args.trial, 'elapsedSeconds': round(time.time() - started, 2),
              'profile': args.profile,
              'returncode': process.returncode, 'timedOut': timed_out, 'usage': usage,
              'commandCount': len(commands), 'failedCommands': sum(c.get('exit_code', 0) != 0 for c in commands),
              'protocolHashes': protocol, 'codexVersion': subprocess.check_output(['codex', '--version'], text=True).strip(),
              'requestedModel': case['host']['model'], 'reasoningEffort': case['host']['reasoningEffort'],
              'operatorInterventionsDuringTask': 0,
              'scope': 'Native Codex execution, explicit skill request, runtime already installed; no ablation or blind review.'}
    (trial / 'execution.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
