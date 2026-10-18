#!/usr/bin/env python3
"""Shared deterministic maintainer/CI gate. Never runs a model or voice provider."""
import argparse
import ast
import os
from pathlib import Path
import subprocess
import sys

from bundle import ROOT, metadata
from release import public_files, scan_history, scan_public
from platform_tools import bun_binary, npm_command
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--python', default=sys.executable, help='Python with Pillow for page tests')
    parser.add_argument('--skip-browser', action='store_true', help='Quick iteration only; not the release gate')
    parser.add_argument('--public-history', action='store_true', help='Require sanitized public commit metadata/history')
    parser.add_argument('--history-identity-ref', action='append', help='Actual PR base/head commit hashes; blob scanning still covers all refs')
    args = parser.parse_args()
    metadata()
    files = public_files()
    scan_public(files)
    if args.public_history:
        scan_history(ROOT, identity_refs=args.history_identity_ref)
    elif args.history_identity_ref:
        parser.error('--history-identity-ref requires --public-history')
    for relative, path in files.items():
        if path.suffix == '.py':
            ast.parse(path.read_text(encoding='utf-8'), filename=relative)
        elif path.suffix == '.mjs':
            subprocess.run(['node', '--check', str(path)], check=True)
    # Native Windows does not need Bash/WSL. CI parses PowerShell there;
    # validate the POSIX entry point on the POSIX matrix hosts.
    if os.name != 'nt':
        subprocess.run(['bash', '-n', 'scripts/setup.sh'], cwd=ROOT, check=True)
    commands = [
        ['node', 'node_modules/typescript/bin/tsc', '--noEmit'],
        npm_command({'npm': shutil.which('npm'), 'node': shutil.which('node')}, 'run', 'test:unit', '--prefix', 'packages/demo/capture'),
        [str(bun_binary(ROOT / 'packages/demo/remotion')), 'test', 'packages/demo/walkthrough'],
        [args.python, '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_*.py'],
        [args.python, '-m', 'unittest', 'discover', '-s', 'packages/demo/update/scripts', '-p', 'test_*.py'],
        [args.python, '-m', 'unittest', 'discover', '-s', 'benchmarks/blog-v0', '-p', 'test_*.py'],
    ]
    if not args.skip_browser:
        commands.append(npm_command({'npm': shutil.which('npm'), 'node': shutil.which('node')}, 'run', 'test:e2e', '--prefix', 'packages/demo/capture'))
    for command in commands:
        print('CHECK ' + ' '.join(command), flush=True)
        subprocess.run(command, cwd=ROOT, check=True)
    print('Deterministic checks passed. Installed smoke, host tasks and visual review are separate gates.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(f'check: {error}')
