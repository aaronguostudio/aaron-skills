"""Exercise an isolated existing installation; never use global skill/bin paths."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

from managed_registration import active_release
from platform_tools import configure_console
from bundle import SKILLS


def main():
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('root', 'skills-dir', 'bin-dir'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    root, skills, binaries = (p.resolve() for p in (args.root, args.skills_dir, args.bin_dir))
    # This verifier removes/reinstalls registrations. Require explicit test paths
    # under one isolated workspace, with no source checkout or global folders.
    if not all(p.is_relative_to(root.parent) for p in (skills, binaries)) or root.parent == Path.home():
        raise ValueError('Use root, skills and bin directories under one isolated validation workspace.')
    if any((parent / '.git').exists() for parent in (root, *root.parents)):
        raise ValueError('Keep installation verification outside source repositories.')
    def current():
        return active_release(root) if os.name == 'nt' else (root / 'current').resolve()
    def run(*extra, env=None, success=True):
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('install.py')),
                                 '--agent', 'codex', '--root', str(root), '--skills-dir', str(skills),
                                 '--bin-dir', str(binaries), *extra], env=env)
        if success and result.returncode:
            raise ValueError(f'Installation lifecycle command failed: {extra}')
        if not success and result.returncode == 0:
            raise ValueError('The missing-prerequisite installation unexpectedly passed')
    initial = current()
    if not initial or not (initial / 'READY').is_file():
        raise ValueError('First create the isolated installation, then run lifecycle verification.')
    # Use sentinel names that cannot silently overwrite existing work.
    token = uuid4().hex[:8]
    sentinel = root / ('lifecycle-retained-' + token + '.txt')
    unrelated = skills / ('lifecycle-unrelated-' + token)
    sentinel.write_text('retained', encoding='utf-8')
    unrelated.mkdir(exist_ok=False)
    (unrelated / 'SKILL.md').write_text('unrelated', encoding='utf-8')
    run()
    upgraded = current()
    run()
    repeated = current()
    if repeated != upgraded:
        raise ValueError('An identical installation must reuse the ready release.')
    run('--repair')
    repaired = current()
    if repaired == repeated:
        raise ValueError('Repair must prepare a separate release before activation.')
    run(env={**os.environ, 'PATH': ''}, success=False)
    if current() != repaired:
        raise ValueError('A failed installation changed the active release.')
    run('--uninstall')
    for name in SKILLS:
        if (skills / name).exists() or (skills / name).is_symlink():
            raise ValueError('Uninstall left a managed skill registration.')
    if sentinel.read_text(encoding='utf-8') != 'retained' or not (unrelated / 'SKILL.md').is_file():
        raise ValueError('Uninstall changed unrelated work.')
    if not repaired.is_dir():
        raise ValueError('Uninstall removed the retained runtime.')
    run()
    final = current()
    subprocess.run([sys.executable, str(final / 'scripts/cli.py'), 'doctor'], check=True)
    report = {'passed': True, 'initial': str(initial), 'upgraded': str(upgraded), 'repeated': str(repeated), 'repaired': str(repaired),
              'final': str(final), 'failedPrerequisitesPreservedActive': True, 'unrelatedPreserved': True,
              'uninstallRetainedRuntime': True}
    (root / 'lifecycle-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
