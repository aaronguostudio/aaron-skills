#!/usr/bin/env python3
"""Opt-in newcomer execution in a fresh Codex profile; no inherited conversation."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import threading
import time

from run import clean_environment, require_external

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
from platform_tools import private_path


def collect(artifacts, ffprobe):
    """Validate files independently of the agent's final claim."""
    captures = []
    for file in artifacts.rglob('capture.json'):
        try:
            if json.loads(file.read_text(encoding='utf-8')).get('status') == 'passed' and (file.parent / 'video.webm').is_file():
                captures.append(file)
        except (ValueError, OSError):
            pass
    videos = []
    for file in artifacts.rglob('*.mp4'):
        result = subprocess.run([ffprobe, '-v', 'error', '-show_streams', '-of', 'json', str(file)], capture_output=True, text=True)
        try:
            if result.returncode == 0 and any(stream.get('codec_type') == 'video' for stream in json.loads(result.stdout)['streams']):
                videos.append(file)
        except (ValueError, KeyError):
            pass
    pages = [file for file in artifacts.rglob('*.html') if 'data:image/' in file.read_text(encoding='utf-8', errors='replace')]
    previews = list(artifacts.rglob('body-preview.png'))
    covers = list(artifacts.rglob('cover.png'))
    previews_first = bool(videos and previews and covers and min(p.stat().st_mtime for p in previews) <= min(v.stat().st_mtime for v in videos)
                          and min(p.stat().st_mtime for p in covers) <= min(v.stat().st_mtime for v in videos))
    manifests = []
    for file in artifacts.rglob('render-manifest.json'):
        try:
            manifests.append(json.loads(file.read_text(encoding='utf-8')))
        except ValueError:
            pass
    preserved = any(any(item.get('sourceCaptureSha256') == hashlib.sha256(capture.read_bytes()).hexdigest()
                        and item.get('sourceVideoSha256') == hashlib.sha256((capture.parent / 'video.webm').read_bytes()).hexdigest()
                        for item in manifests) for capture in captures)
    checks = {'passedCapture': bool(captures), 'playableVideo': bool(videos), 'screenshotHandoff': bool(pages),
              'coverAndBodyPreviewBeforeVideo': previews_first, 'originalEvidencePreserved': preserved,
              'silentProvider': bool(manifests) and all(item.get('voiceProvider') == 'none' for item in manifests)}
    return {'passed': all(checks.values()), 'checks': checks, 'artifactCounts': {'captures': len(captures), 'videos': len(videos), 'handoffs': len(pages)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, required=True, help='A verified installed release, not its source checkout')
    parser.add_argument('--auth-home', type=Path, help='Existing Codex authentication directory; only auth.json is copied privately')
    parser.add_argument('--model', help='Optional pinned benchmark model; otherwise the CLI default is recorded')
    parser.add_argument('--timeout', type=int, default=600)
    args = parser.parse_args()
    codex = shutil.which('codex')
    if not codex:
        parser.error('Install/sign in to Codex locally; this runner never creates an account')
    auth_home = args.auth_home or Path(os.environ.get('CODEX_HOME', Path.home() / '.codex'))
    auth = auth_home / 'auth.json'
    if not auth.is_file():
        parser.error('No file-based local authentication available; supply --auth-home after signing in')
    workspace = require_external(args.workspace)
    workspace.mkdir(parents=True, exist_ok=False)
    private_path(workspace, directory=True)
    profile = workspace / 'profile'; profile.mkdir()
    codex_home = profile / '.codex'; codex_home.mkdir()
    private_path(codex_home, directory=True)
    copied_auth = codex_home / 'auth.json'
    runtime = args.runtime.resolve()
    config = json.loads((runtime / 'installed.json').read_text(encoding='utf-8'))
    manifest = json.loads((runtime / 'bundle-manifest.json').read_text(encoding='utf-8'))
    project = workspace / 'project'; project.mkdir()
    artifacts = workspace / 'artifacts'; artifacts.mkdir()
    skills = project / '.agents/skills'; skills.mkdir(parents=True)
    for name in manifest['skills']:
        shutil.copytree(runtime / 'skills' / name, skills / name)
    class Application(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.end_headers()
            body = ('<h1>Result</h1><section aria-label="Result"><h2>Three example items</h2><ul><li>Camera ready</li><li>Captions ready</li><li>Message ready</li></ul></section>' if self.path == '/result'
                    else '<h1>First walkthrough</h1><p>A fictional public application. No sign-in is needed.</p><button onclick="location.href=\'/result\'">Open result</button>')
            self.wfile.write(('<!doctype html><html lang="en"><meta charset="utf-8"><style>body{font:24px system-ui;padding:70px;background:#f5f6fa}section{background:white;padding:24px}button{font:inherit;padding:18px}</style>'+body+'</html>').encode())
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), Application)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    prompt = (HERE / 'tasks.md').read_text(encoding='utf-8') + (
        f'\nProject: {project}\nArtifact directory (all captures/previews/video/HTML): {artifacts}\n'
        f'Public fictional application: http://127.0.0.1:{server.server_port}\n'
        f'Installed CLI: {runtime / "scripts/cli.py"} (invoke with {config["tools"]["python"]})\n'
        'The Demo runtime is already installed and checked. This trial evaluates first use after installation. '
        'Project skills are registered; no adapter or presentation has been authored. '
        'Keep the app read-only. Do not inspect authentication files or other benchmark runs. '
        'Do not run another agent. Do not modify the installed runtime.\n')
    (workspace / 'prompt.txt').write_text(prompt, encoding='utf-8')
    env = clean_environment(profile, workspace)
    env['CODEX_HOME'] = str(codex_home)
    env['PATH'] = os.pathsep.join(dict.fromkeys([*(str(Path(path).parent) for path in config['tools'].values()), env.get('PATH', '')]))
    env['PLAYWRIGHT_BROWSERS_PATH'] = config['playwrightBrowsers']
    command = [codex, 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
               '--sandbox', 'danger-full-access', '-c', 'approval_policy="never"', '--json',
               '--output-last-message', str(workspace / 'final.txt')]
    if args.model:
        command += ['--model', args.model]
    command += ['-']
    started = time.monotonic()
    timed_out = False
    try:
        shutil.copyfile(auth, copied_auth)
        private_path(copied_auth)
        with (workspace / 'events.jsonl').open('w', encoding='utf-8') as output, (workspace / 'stderr.log').open('w', encoding='utf-8') as errors:
            process = subprocess.Popen(command, cwd=project, env=env, stdin=subprocess.PIPE, stdout=output, stderr=errors, text=True,
                                       start_new_session=os.name != 'nt', creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0)
            try:
                process.communicate(prompt, timeout=args.timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
                else:
                    os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    if os.name != 'nt':
                        os.killpg(process.pid, signal.SIGKILL)
                    else:
                        process.kill()
                    process.wait(timeout=5)
        result = collect(artifacts, config['tools']['ffprobe'])
        events = []
        for line in (workspace / 'events.jsonl').read_text(encoding='utf-8').splitlines():
            try:
                events.append(json.loads(line))
            except ValueError:
                pass
        commands = [event['item'] for event in events if event.get('type') == 'item.completed' and event.get('item', {}).get('type') == 'command_execution']
        result.update(kind='native-agent-newcomer', sourceRevision=manifest['sourceRevision'], bundleId=manifest['id'],
                      requestedModel=args.model, hostVersion=subprocess.check_output([codex, '--version'], text=True).strip(),
                      elapsedSeconds=round(time.monotonic() - started, 2), timedOut=timed_out, returncode=process.returncode,
                      humanAcceptance='not-assessed', liveProviders='not-assessed', priorConversation='none',
                      authentication='private local copy; removed after run', operatorInterventions=0,
                      commandCount=len(commands), failedCommands=sum(item.get('exit_code', 0) != 0 for item in commands),
                      usage=next((event.get('usage') for event in reversed(events) if event.get('type') == 'turn.completed'), None),
                      protocolHashes={name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in ('case.json', 'tasks.md', 'rubric.json', 'native.py')})
        result['passed'] = result['passed'] and not timed_out and process.returncode == 0
        (workspace / 'native-report.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result, indent=2))
        return int(not result['passed'])
    finally:
        server.shutdown(); server.server_close()
        copied_auth.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
