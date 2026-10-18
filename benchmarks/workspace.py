"""Raw benchmark execution/evidence paths must be outside every Git checkout."""
from pathlib import Path


def require_external(path):
    resolved = Path(path).expanduser().resolve()
    if any((parent / '.git').exists() for parent in (resolved, *resolved.parents)):
        raise ValueError('Benchmark workspaces and raw evidence must be outside every Git repository, including ignored directories and linked worktrees')
    return resolved
