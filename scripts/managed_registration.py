"""Copy-based skill registration for ordinary Windows accounts.

The version pointer and registration record live outside the immutable release.
Only unchanged files previously registered by this installation may be replaced.
POSIX installations keep their existing symlink layout.
"""
import hashlib
import json
from pathlib import Path
import shutil
import stat
from uuid import uuid4


def digest(path):
    path = Path(path)
    def is_link(value):
        return value.is_symlink() or bool(getattr(value.lstat(), 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    if not path.exists() and not path.is_symlink():
        return None
    if is_link(path):
        return None
    if path.is_file():
        return {'file': hashlib.sha256(path.read_bytes()).hexdigest()}
    if path.is_dir():
        files = {}
        directories = []
        for child in path.rglob('*'):
            if is_link(child):
                return None
            if child.is_file():
                files[child.relative_to(path).as_posix()] = hashlib.sha256(child.read_bytes()).hexdigest()
            elif child.is_dir():
                directories.append(child.relative_to(path).as_posix())
        return {'tree': files, 'directories': sorted(directories)}
    return None


def record(root):
    path = root / 'registrations.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}


def active_release(root):
    pointer = root / 'active.json'
    if not pointer.exists():
        return None
    release = Path(json.loads(pointer.read_text(encoding='utf-8'))['release']).resolve()
    if not release.is_relative_to((root / 'releases').resolve()):
        raise ValueError('The active release pointer must stay inside this installation.')
    return release


def paths(root, skills_dirs, bin_dir, skills):
    return [*(directory / name for directory in skills_dirs for name in skills),
            bin_dir / 'aaron-demo.cmd', bin_dir / 'aaron-demo.ps1', root / 'launch.py', root / 'active.json']


def check_conflicts(root, skills_dirs, bin_dir, skills):
    previous = record(root)
    for path in paths(root, skills_dirs, bin_dir, skills):
        if path.exists() or path.is_symlink():
            expected = previous.get(str(path))
            actual = digest(path)
            if actual is None or expected is None or actual != expected:
                raise ValueError(f'Existing or modified entry preserved: {path}. Move or rename it before retrying.')


def remove(path):
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def activate(root, release, skills_dirs, bin_dir, skills, python, configuration=None):
    check_conflicts(root, skills_dirs, bin_dir, skills)
    launcher = b'''from pathlib import Path
import json, subprocess, sys
root = Path(__file__).resolve().parent
release = Path(json.loads((root / 'active.json').read_text(encoding='utf-8'))['release']).resolve()
if not release.is_relative_to((root / 'releases').resolve()):
    sys.exit('Invalid active release pointer')
sys.exit(subprocess.run([sys.executable, str(release / 'scripts/cli.py'), *sys.argv[1:]]).returncode)
'''
    def ps_quoted(value):
        return "'" + str(value).replace("'", "''") + "'"
    # CMD reads an ASCII-only wrapper; PowerShell 5 recognizes the UTF-8 BOM in
    # its companion. Unicode usernames and paths need no global code-page change.
    command = b'@echo off\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0aaron-demo.ps1" %*\r\n'
    ps = ("$ErrorActionPreference = 'Stop'\r\n$env:PYTHONUTF8 = '1'\r\n[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\r\n& " + ps_quoted(python) + ' ' +
          ps_quoted(root / 'launch.py') + " @args\r\nexit $LASTEXITCODE\r\n").encode('utf-8-sig')
    desired = {directory / name: release / 'skills' / name for directory in skills_dirs for name in skills}
    desired.update({bin_dir / 'aaron-demo.cmd': command, bin_dir / 'aaron-demo.ps1': ps, root / 'launch.py': launcher})
    if configuration is not None:
        desired[release / 'installed.json'] = (json.dumps(configuration, indent=2) + '\n').encode('utf-8')
    desired[root / 'active.json'] = (json.dumps({'release': str(release)}) + '\n').encode('utf-8')
    staged, backups, applied = {}, {}, []
    token = uuid4().hex
    manifest = root / ('registrations.stage-' + token)
    try:
        for path, source in desired.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(path.name + '.stage-' + token)
            staged[path] = temporary
            if isinstance(source, bytes):
                temporary.write_bytes(source)
            else:
                shutil.copytree(source, temporary)
        check_conflicts(root, skills_dirs, bin_dir, skills)
        hashes = {str(path): digest(temporary) for path, temporary in staged.items()}
        for path, temporary in staged.items():
            if path.exists():
                backup = path.with_name(path.name + '.backup-' + token)
                path.replace(backup)
                backups[path] = backup
            temporary.replace(path)
            applied.append(path)
        manifest.write_text(json.dumps(hashes, indent=2) + '\n', encoding='utf-8')
        manifest.replace(root / 'registrations.json')
    except BaseException:
        for path in reversed(applied):
            remove(path)
        for path, backup in backups.items():
            backup.replace(path)
        raise
    finally:
        manifest.unlink(missing_ok=True)
        for temporary in staged.values():
            if temporary.exists():
                remove(temporary)
    for backup in backups.values():
        # Activation has committed. A locked backup is harmless and recoverable.
        try:
            remove(backup)
        except OSError:
            pass


def uninstall(root, config, skills):
    previous = record(root)
    external = paths(root, [Path(p) for p in config['skillsDirs']], Path(config['binDir']), skills)[:-2]
    for path in external:
        if path.exists() and previous.get(str(path)) == digest(path) and digest(path) is not None:
            remove(path)
            print(f'Removed registration: {path}')
        elif path.exists() or path.is_symlink():
            print(f'Preserved modified or unrelated entry: {path}')
    print('Runtime retained. Captures, sessions and user configuration were not deleted.')


def errors(root, release, config, skills):
    failures = []
    previous = record(root)
    for path in paths(root, [Path(p) for p in config['skillsDirs']], Path(config['binDir']), skills):
        if previous.get(str(path)) != digest(path) or digest(path) is None:
            failures.append(f'Missing or modified registration: {path}')
    for directory in config['skillsDirs']:
        for name in skills:
            if digest(Path(directory) / name) != digest(release / 'skills' / name):
                failures.append(f'Skill copy differs from release: {name}')
    if active_release(root) != release.resolve():
        failures.append('Active release differs from this command')
    return failures
