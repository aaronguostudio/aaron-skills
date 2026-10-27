#!/usr/bin/env python3
"""Install the Demo bundle; activate only after verification passes."""
import argparse
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
from platform_tools import check_system, configure_console, default_root, default_bin, installation_lock, npm_command, venv_python
import managed_registration
from runtime_activity import runtime_activity


def activate_release(root, release, config, skills, *, expected_active=None):
    """Switch a prepared runtime without changing a running task or user edits."""
    from updates import write_json
    directories = [Path(p) for p in config.get('skillsDirs', [config['skillsDir']])]
    bin_dir = Path(config['binDir'])
    with runtime_activity(root, exclusive=True):
        previous = managed_registration.active_release(root) if os.name == 'nt' else (root / 'current').resolve() if (root / 'current').is_symlink() else None
        if expected_active is not None:
            from updates import verify_bundle
            if (root / '.updates-disabled').exists():
                raise ValueError('This installation was uninstalled. Run setup to reinstall; automatic updates remain disabled.')
            if previous != expected_active.resolve():
                raise ValueError('The active version changed during update preparation. Check again before updating.')
            verify_bundle(previous)
        previous_manifest = previous / 'bundle-manifest.json' if previous else None
        previous_skills = json.loads(previous_manifest.read_text(encoding='utf-8')).get('skills', []) if previous_manifest and previous_manifest.is_file() else []
        retired_skills = set(previous_skills) - set(skills)
        record = root / 'previous-release.json'
        old_record = record.read_bytes() if record.is_file() else None
        # Write the rollback pointer before activation. A full disk must not
        # leave a newly active release without its previous-version record.
        if previous and previous != release.resolve():
            write_json(record, {'release': str(previous)})
        try:
            if os.name == 'nt':
                managed_registration.activate(root, release, directories, bin_dir, skills, config['tools']['python'], configuration=config, retired_skills=retired_skills)
            else:
                _activate_posix(root, release, config, directories, bin_dir, write_json, skills, retired_skills, previous)
        except BaseException:
            if old_record is None:
                record.unlink(missing_ok=True)
            else:
                record.write_bytes(old_record)
            raise


def _activate_posix(root, release, config, directories, bin_dir, write_json, skills, retired_skills, previous):
    # Recheck just before switching; another program may have replaced a link.
    wanted = link_conflicts(root, directories, bin_dir, skills)
    retired = []
    for directory in directories:
        for name in retired_skills:
            path = directory / name
            if path.exists() or path.is_symlink():
                if not path.is_symlink() or path.resolve() != (previous / 'skills' / name).resolve():
                    raise ValueError(f'Existing or modified entry preserved: {path}')
                retired.append(path)
    old = {path: path.readlink() if path.is_symlink() else None for path in [root / 'current', *wanted, *retired]}
    previous_config = (release / 'installed.json').read_bytes()
    try:
        for path in (*directories, bin_dir):
            path.mkdir(parents=True, exist_ok=True)
        write_json(release / 'installed.json', config)
        atomic_link(release, root / 'current')
        for link, target in wanted.items():
            atomic_link(target, link)
        for path in retired:
            path.unlink()
    except BaseException:
        (release / 'installed.json').write_bytes(previous_config)
        for path, target in old.items():
            if target is None:
                path.unlink(missing_ok=True)
            else:
                atomic_link(target, path)
        raise

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
            ({'codex': ['.agents'], 'claude': ['.claude'], 'cursor': ['.cursor'], 'both': ['.agents', '.claude']}[agent])]


def verify_installed_smoke(run, command):
    """Activation already succeeded. A failed smoke must remain a failed check."""
    try:
        run(command)
    except (OSError, subprocess.CalledProcessError) as error:
        if os.name == 'nt':
            retry = '& ' + ' '.join("'" + str(part).replace("'", "''") + "'" for part in command)
        else:
            retry = shlex.join([str(part) for part in command])
        raise ValueError('Runtime installed and activated, but the smoke check failed. '
                         'The active installation was retained; the end-to-end workflow is not verified. '
                         f'Review the smoke output, then retry:\n{retry}\nCause: {error}') from error


def link_conflicts(root, skills_dir, bin_dir, skills=SKILLS):
    directories = [skills_dir] if isinstance(skills_dir, Path) else skills_dir
    wanted = {directory / name: root / 'current/skills' / name for directory in directories for name in skills}
    wanted[bin_dir / 'aaron-demo'] = root / 'current/aaron-demo'
    conflicts = [str(path) for path, target in wanted.items()
        if (path.exists() or path.is_symlink()) and (not path.is_symlink() or path.resolve() != target.resolve())]
    if conflicts:
        raise ValueError('Existing skills/command were preserved. Move or rename these entries, then retry:\n' + '\n'.join(conflicts))
    return wanted

def prerequisites():
    check_system()
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
    if os.name == 'nt':
        current = managed_registration.active_release(root)
        if current is not None:
            config = json.loads((current / 'installed.json').read_text(encoding='utf-8'))
            managed_registration.uninstall(root, config, SKILLS)
        return
    current = root / 'current'
    config_path = current / 'installed.json'
    if not current.is_symlink() or not config_path.is_file():
        print('No active installation. Nothing removed.')
        return
    config = json.loads(config_path.read_text(encoding='utf-8'))
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
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=default_root())
    parser.add_argument('--agent', choices=['codex', 'claude', 'cursor', 'both'], default='codex')
    parser.add_argument('--skills-dir', type=Path, help='Override one host registration directory.')
    parser.add_argument('--smoke', action='store_true', help='Run the public recording/rendering check after installation.')
    parser.add_argument('--uninstall', action='store_true', help='Remove managed registrations; retain runtime and all user data.')
    parser.add_argument('--bin-dir', type=Path, default=default_bin())
    parser.add_argument('--repair', action='store_true', help='Build and verify a fresh release without modifying the active release.')
    parser.add_argument('--registration-dir', type=Path, action='append', help=argparse.SUPPRESS)
    parser.add_argument('--expected-active', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    root, bin_dir = [path.expanduser().resolve() for path in (args.root, args.bin_dir)]
    if args.uninstall:
        root.mkdir(parents=True, exist_ok=True)
        # Stop an already-running updater from re-registering after uninstall.
        (root / '.updates-disabled').touch()
        with installation_lock(root):
            uninstall(root)
        return
    tools = prerequisites()
    if args.registration_dir and args.skills_dir:
        parser.error('--registration-dir cannot combine with --skills-dir')
    directories = [p.expanduser().resolve() for p in args.registration_dir] if args.registration_dir else registration_dirs(args.agent, Path.home(), args.skills_dir)
    skills_dir = directories[0]
    # Never mix an installation with its source tree, a project, or captured work.
    if root.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError('Install outside the source checkout.')
    with installation_lock(root):
        current = managed_registration.active_release(root) if os.name == 'nt' else root / 'current'
        if current is None:
            current = root / 'releases/not-installed'
        if os.name != 'nt' and (current.exists() or current.is_symlink()) and not current.is_symlink():
            raise ValueError(f'Preserved existing directory: {current}')
        if current.is_symlink() and not current.resolve().is_relative_to((root / 'releases').resolve()):
            raise ValueError(f'Preserved unrelated current link: {current}')
        previous_path = current / 'installed.json'
        if previous_path.is_file():
            previous = json.loads(previous_path.read_text(encoding='utf-8'))
            directories = list(dict.fromkeys([*(Path(p) for p in previous.get('skillsDirs', [previous['skillsDir']])), *directories]))
        if os.name == 'nt':
            managed_registration.check_conflicts(root, directories, bin_dir, SKILLS)
            wanted = {}
        else:
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
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        manifest.update(sourceRevision=source['sourceRevision'], sourceDirty=source['sourceDirty'])
        spec = importlib.util.spec_from_file_location('demo_cli', release / 'scripts/cli.py')
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        cli.ROOT = release
        cli.ENGINE = release / 'packages/demo/capture'
        cli.RENDER = release / 'packages/demo/remotion'
        config = cli.settings()
        # Save machine-local executable paths; no credentials belong here.
        config.update(tools=tools, skillsDir=str(directories[0]), skillsDirs=[str(p) for p in directories], binDir=str(bin_dir), agent=args.agent,
                      installRoot=str(root), registrationMode='copies' if os.name == 'nt' else 'links')
        # Retry a partially installed release without changing the currently active one.
        def run(command, **kwargs):
            subprocess.run([str(part) for part in command], env=cli.environment(config), check=True, **kwargs)
        if not (release / 'READY').exists():
            for directory in (cli.ENGINE, cli.RENDER):
                run(npm_command(tools, 'ci', '--no-audit', '--no-fund'), cwd=directory)
            run([sys.executable, '-m', 'venv', release / '.venv'])
            run([venv_python(release), '-m', 'pip', 'install', '--disable-pip-version-check', '-r', release / 'scripts/requirements.txt'])
        # Browser caches may have been removed after a successful installation. Prepare them on retries too.
        run([tools['node'], cli.ENGINE / 'node_modules/playwright/cli.js', 'install', 'chromium'])
        run([tools['node'], cli.RENDER / 'node_modules/@remotion/cli/remotion-cli.js', 'browser', 'ensure'], cwd=cli.RENDER)
        if cli.doctor(config, check_links=False):
            raise ValueError('Verification failed; the active release was preserved. Retry with --repair to rebuild dependencies and files.')
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        if os.name != 'nt':
            (release / 'installed.json').write_text(json.dumps(config, indent=2) + '\n')
        launcher = release / 'aaron-demo'
        launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(tools['python']) + ' ' +
            shlex.quote(str(release / 'scripts/cli.py')) + ' "$@"\n', encoding='utf-8')
        launcher.chmod(0o755)
        (release / 'READY').touch()
        # Check again after downloads, before any links change.
        activate_release(root, release, config, SKILLS, expected_active=args.expected_active)
        if cli.doctor(config):
            raise ValueError('Installed files passed, but skill registration needs attention.')
        if args.expected_active is None:
            (root / '.updates-disabled').unlink(missing_ok=True)
        print(f'Installed for {args.agent}. Start a new agent session in your application project.\nCommand: {bin_dir / "aaron-demo"}\nSmoke check: {bin_dir / "aaron-demo"} smoke')
        print('Updates: compatible stable patches install automatically after Demo commands; larger changes only notify.\n'
              'Control: aaron-demo update policy compatible|notify|off. Rollback: aaron-demo rollback.\n'
              'Local modified-source installations do not check or update automatically.')
        if str(bin_dir) not in os.environ.get('PATH', '').split(os.pathsep):
            if os.name == 'nt':
                print(f'Add {bin_dir} to your user PATH, then open a new terminal. This installer does not change PATH.')
            else:
                print('Add to your shell profile if needed: export PATH=' + shlex.quote(str(bin_dir)) + ':"$PATH"')
        if args.smoke:
            verify_installed_smoke(run, [tools['python'], release / 'scripts/cli.py', 'smoke'])

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f'install: {error}')
