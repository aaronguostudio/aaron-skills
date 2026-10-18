#!/usr/bin/env python3
"""Prepare a committed, credential-free local blog fixture. Does not start it or publish."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blog-repo', type=Path, required=True)
    parser.add_argument('--workspace', type=Path, required=True)
    args = parser.parse_args()
    case = json.loads((HERE / 'case.json').read_text())
    root = args.workspace.resolve()
    if root.exists():
        parser.error('Workspace must be new; preserve prior baseline artifacts.')
    dependencies = args.blog_repo.resolve() / 'node_modules'
    if not dependencies.is_dir():
        parser.error('Prepare the blog locked dependencies first.')
    data = subprocess.check_output(['git', '-C', str(args.blog_repo), 'archive', case['applicationRevision']])
    root.mkdir(parents=True, mode=0o700)
    blog = root / 'blog'
    blog.mkdir()
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        archive.extractall(blog, filter='data')
    # A symlink to another project's node_modules fails Vite's filesystem boundary.
    # Clone on macOS/APFS; elsewhere a full independent copy is required.
    if platform.system() == 'Darwin':
        subprocess.run(['cp', '-cR', str(dependencies), str(blog / 'node_modules')], check=True)
    else:
        shutil.copytree(dependencies, blog / 'node_modules', symlinks=True)
    config = blog / 'nuxt.config.ts'
    text = config.read_text()
    start = text.index('      script: [')
    end = text.index('      ],', start) + len('      ],')
    text = text[:start] + '      script: [], // Benchmark fixture: disable external analytics' + text[end:]
    text = text.replace("...(process.env.NODE_ENV === 'production' ? [] : ['@nuxt/fonts']),",
                        '// Benchmark fixture: no external font download')
    config.write_text(text)
    evidence = {'revision': case['applicationRevision'],
                'overlay': ['no external analytics script', 'no dev font download'],
                'configSha256': hashlib.sha256(config.read_bytes()).hexdigest(),
                'lockfileSha256': hashlib.sha256((blog / 'pnpm-lock.yaml').read_bytes()).hexdigest()}
    (root / 'fixture.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print('Fixture prepared. Build Nuxt with node-server preset, start .output/server/index.mjs on loopback port 4190, install the chosen Demo revision, then run run.py.')


if __name__ == '__main__':
    main()
