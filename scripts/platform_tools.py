"""Small system boundary shared by installation, commands and verification."""
from contextlib import contextmanager
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys


def configure_console():
    os.environ['PYTHONUTF8'] = '1'
    if os.name == 'nt':
        for stream in (sys.stdout, sys.stderr):
            if hasattr(stream, 'reconfigure'):
                stream.reconfigure(encoding='utf-8')


def venv_python(root):
    return Path(root) / ('.venv/Scripts/python.exe' if os.name == 'nt' else '.venv/bin/python3')


def bun_binary(render):
    # The pinned npm package installs a real executable at this path on all OSes.
    # Avoid npm's .cmd/.sh shims, which need different shell quoting rules.
    return Path(render) / 'node_modules/bun/bin/bun.exe'


def npm_command(tools, *args):
    # Volta and other multi-call shims dispatch on argv[0]. Dereferencing their
    # npm symlink changes the command into volta-shim/vp and loses that dispatch.
    npm = Path(tools['npm']).absolute()
    if npm.suffix.lower() == '.cmd':
        cli = npm.parent / 'node_modules/npm/bin/npm-cli.js'
        if not cli.is_file():
            raise ValueError('Cannot locate npm-cli.js beside npm.cmd. Install the standard Node.js distribution.')
        return [tools['node'], str(cli.resolve()), *args]
    return [str(npm), *args]


def check_media_tools(tools=None):
    """Both tools must actually launch; a package-manager success is insufficient."""
    paths = tools if tools is not None else {name: shutil.which(name) for name in ('ffmpeg', 'ffprobe')}
    for name in ('ffmpeg', 'ffprobe'):
        path = paths.get(name)
        if not path:
            raise ValueError(f'{name} is required. Install FFmpeg including ffprobe and verify both tools are on PATH.')
        try:
            subprocess.run([str(path), '-version'], check=True, capture_output=True)
        except (OSError, subprocess.CalledProcessError) as error:
            raise ValueError(f'{name} could not run. Repair FFmpeg including ffprobe before running media checks.') from error
    return paths


def check_system():
    system = platform.system()
    if system == 'Darwin':
        return
    if system == 'Windows' and platform.machine().lower() in ('amd64', 'x86_64'):
        return
    if system == 'Linux':
        release = platform.freedesktop_os_release()
        if release.get('ID') == 'ubuntu' and release.get('VERSION_ID') == '24.04':
            return
        raise ValueError('The Linux installer currently targets Ubuntu 24.04. Other distributions are unverified.')
    raise ValueError('This installer targets macOS, Ubuntu 24.04 and Windows x64. See docs/compatibility.md for verification status.')


def default_root():
    if os.name == 'nt':
        return Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData/Local')) / 'AaronSkills/demo'
    return Path.home() / '.local/share/aaron-skills/demo'


def default_bin():
    return default_root().parent / 'bin' if os.name == 'nt' else Path.home() / '.local/bin'


def private_path(path, directory=False):
    if os.name == 'nt':
        subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                        '-File', str(Path(__file__).with_name('private-path.ps1')), '-Target', str(Path(path).resolve()),
                        *(['-Directory'] if directory else [])], check=True, capture_output=True)
    else:
        Path(path).chmod(0o700 if directory else 0o600)


@contextmanager
def installation_lock(root):
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.install.lock').open('a+b', buffering=0) as lock:
        if os.name == 'nt':
            import msvcrt
            def acquire():
                # Windows byte-range locks also deny reads of the locked byte.
                # Inspect metadata rather than reading another installer's lock.
                if os.fstat(lock.fileno()).st_size == 0:
                    lock.write(b'0')
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            release = lambda: (lock.seek(0), msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1))
        else:
            import fcntl
            acquire = lambda: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            release = lambda: fcntl.flock(lock, fcntl.LOCK_UN)
        try:
            acquire()
        except OSError as error:
            if error.errno not in (11, 13, 35):
                raise
            raise ValueError('Another installer is running for this installation. Wait for it to finish, then retry.') from None
        try:
            yield
        finally:
            release()
