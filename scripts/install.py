#!/usr/bin/env python3
"""Install the demo-only bundle on macOS; activate only after verification passes."""
import argparse
from contextlib import contextmanager
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import shlex
import subprocess
import sys
from uuid import uuid4

from bundle import ROOT, SKILLS, build, metadata

@contextmanager
def installation_lock(root):
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.install.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another installer is running for this installation. Wait for it to finish, then retry.') from None
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)

def atomic_link(target, link):
    temporary = link.with_name(link.name + f'.tmp-{os.getpid()}')
    temporary.symlink_to(target)
    try:
        temporary.replace(link)
    finally:
        temporary.unlink(missing_ok=True)

def registration_dirs(agent, home, override=None):
    if override is not None:
        if agent == 'both':
            raise ValueError('--skills-dir requires a single --agent')
        return [override.expanduser().resolve()]
    return [home / folder / 'skills' for folder in
            ({'codex': ['.agents'], 'claude': ['.claude'], 'both': ['.agents', '.claude']}[agent])]


def link_conflicts(root, skills_dir, bin_dir):
    directories = [skills_dir] if isinstance(skills_dir, Path) else skills_dir
    wanted = {directory / name: root / 'current/skills' / name for directory in directories for name in SKILLS}
    wanted[bin_dir / 'aaron-demo'] = root / 'current/aaron-demo'
    conflicts = [str(path) for path, target in wanted.items()
        if (path.exists() or path.is_symlink()) and (not path.is_symlink() or path.resolve() != target.resolve())]
    if conflicts:
        raise ValueError('Existing skills/command were preserved. Move or rename these entries, then retry:\n' + '\n'.join(conflicts))
    return wanted

def prerequisites():
    if platform.system() != 'Darwin':
        raise ValueError('This installer supports macOS.')
    if sys.version_info < (3, 11):
        raise ValueError('Python >=3.11 is required. Install prerequisites from docs/installation.md.')
    tools = {name: shutil.which(name) for name in ('node', 'npm', 'ffmpeg', 'ffprobe')}
    missing = [name for name, path in tools.items() if not path]
    if missing:
        raise ValueError('Missing prerequisites: ' + ', '.join(missing) + '. See docs/installation.md.')
    version = subprocess.check_output([tools['node'], '-p', 'process.versions.node'], text=True).strip()
    if int(version.split('.')[0]) < 22:
        raise ValueError(f'Node >=22 required; found {version}.')
    tools['python'] = sys.executable
    return tools

def uninstall(root):
    """Remove our registrations only; retain releases, browser caches and user work."""
    current = root / 'current'
    config_path = current / 'installed.json'
    if not current.is_symlink() or not config_path.is_file():
        print('No active installation. Nothing removed.')
        return
    config = json.loads(config_path.read_text())
    directories = [Path(p) for p in config.get('skillsDirs', [config['skillsDir']])]
    wanted = {directory / name: current / 'skills' / name for directory in directories for name in SKILLS}
    wanted[Path(config['binDir']) / 'aaron-demo'] = current / 'aaron-demo'
    for link, target in wanted.items():
        if link.is_symlink() and link.resolve() == target.resolve():
            link.unlink()
            print(f'Removed registration: {link}')
        elif link.exists() or link.is_symlink():
            print(f'Preserved unrelated entry: {link}')
    print('Runtime retained. Captures, sessions and user configuration were not deleted.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.home() / '.local/share/aaron-skills/demo')
    parser.add_argument('--agent', choices=['codex', 'claude', 'both'], default='codex')
    parser.add_argument('--skills-dir', type=Path, help='Override one host registration directory.')
    parser.add_argument('--smoke', action='store_true', help='Run the public recording/rendering check after installation.')
    parser.add_argument('--uninstall', action='store_true', help='Remove managed registrations; retain runtime and all user data.')
    parser.add_argument('--bin-dir', type=Path, default=Path.home() / '.local/bin')
    parser.add_argument('--repair', action='store_true', help='Build and verify a fresh release without modifying the active release.')
    args = parser.parse_args()
    root, bin_dir = [path.expanduser().resolve() for path in (args.root, args.bin_dir)]
    if args.uninstall:
        with installation_lock(root):
            uninstall(root)
        return
    tools = prerequisites()
    directories = registration_dirs(args.agent, Path.home(), args.skills_dir)
    skills_dir = directories[0]
    # Never mix an installation with its source tree, a project, or captured work.
    if root.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError('Install outside the source checkout.')
    with installation_lock(root):
        current = root / 'current'
        if (current.exists() or current.is_symlink()) and not current.is_symlink():
            raise ValueError(f'Preserved existing directory: {current}')
        if current.is_symlink() and not current.resolve().is_relative_to((root / 'releases').resolve()):
            raise ValueError(f'Preserved unrelated current link: {current}')
        previous_path = current / 'installed.json'
        if previous_path.is_file():
            previous = json.loads(previous_path.read_text())
            directories = list(dict.fromkeys([*(Path(p) for p in previous.get('skillsDirs', [previous['skillsDir']])), *directories]))
        wanted = link_conflicts(root, directories, bin_dir)
        source = metadata()
        release_name = source['id'] + (f'-repair-{uuid4().hex[:12]}' if args.repair else '')
        release = root / 'releases' / release_name
        if release.is_symlink():
            raise ValueError(f'Preserved unexpected release symlink: {release}')
        if release.exists() and not (release / 'installed.json').exists():
            raise ValueError(f'Incomplete release preserved at {release}. Remove that release directory, then retry.')
        if not release.exists():
            build(release)
            config = {'tools': tools, 'playwrightBrowsers': str(root / 'browsers/playwright'),
                'skillsDir': str(skills_dir), 'binDir': str(bin_dir)}
            (release / 'installed.json').write_text(json.dumps(config, indent=2) + '\n')
        # Identical content can move from a local test to a committed revision without another dependency install.
        manifest_path = release / 'bundle-manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest.update(sourceRevision=source['sourceRevision'], sourceDirty=source['sourceDirty'])
        spec = importlib.util.spec_from_file_location('demo_cli', release / 'scripts/cli.py')
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        cli.ROOT = release
        cli.ENGINE = release / 'packages/demo/capture'
        cli.RENDER = release / 'packages/demo/remotion'
        config = cli.settings()
        # Save machine-local executable paths; no credentials belong here.
        config.update(tools=tools, skillsDir=str(directories[0]), skillsDirs=[str(p) for p in directories], binDir=str(bin_dir), agent=args.agent)
        # Retry a partially installed release without changing the currently active one.
        def run(command, **kwargs):
            subprocess.run([str(part) for part in command], env=cli.environment(config), check=True, **kwargs)
        if not (release / 'READY').exists():
            for directory in (cli.ENGINE, cli.RENDER):
                run([tools['npm'], 'ci', '--no-audit', '--no-fund'], cwd=directory)
            run([sys.executable, '-m', 'venv', release / '.venv'])
            run([release / '.venv/bin/python3', '-m', 'pip', 'install', '--disable-pip-version-check', '-r', release / 'scripts/requirements.txt'])
        # Browser caches may have been removed after a successful installation. Prepare them on retries too.
        run([tools['node'], cli.ENGINE / 'node_modules/playwright/cli.js', 'install', 'chromium'])
        run([tools['node'], cli.RENDER / 'node_modules/@remotion/cli/remotion-cli.js', 'browser', 'ensure'], cwd=cli.RENDER)
        if cli.doctor(config, check_links=False):
            raise ValueError('Verification failed; the active release was preserved. Retry with --repair to rebuild dependencies and files.')
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        (release / 'installed.json').write_text(json.dumps(config, indent=2) + '\n')
        launcher = release / 'aaron-demo'
        launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(tools['python']) + ' ' +
            shlex.quote(str(release / 'scripts/cli.py')) + ' "$@"\n')
        launcher.chmod(0o755)
        (release / 'READY').touch()
        # Check again after downloads, before any links change.
        link_conflicts(root, directories, bin_dir)
        for path in (*directories, bin_dir):
            path.mkdir(parents=True, exist_ok=True)
        atomic_link(release, current)
        for link, target in wanted.items():
            atomic_link(target, link)
        if cli.doctor(config):
            raise ValueError('Installed files passed, but skill registration needs attention.')
        print(f'Installed for {args.agent}. Start a new agent session in your application project.\nCommand: {bin_dir / "aaron-demo"}\nSmoke check: {bin_dir / "aaron-demo"} smoke')
        if str(bin_dir) not in os.environ.get('PATH', '').split(os.pathsep):
            print('Add to your shell profile if needed: export PATH=' + shlex.quote(str(bin_dir)) + ':"$PATH"')
        if args.smoke:
            run([tools['python'], release / 'scripts/cli.py', 'smoke'])

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f'install: {error}')
