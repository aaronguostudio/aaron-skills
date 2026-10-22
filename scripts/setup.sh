#!/bin/bash
# Local POSIX setup. System package installation is an explicit opt-in.
set -eo pipefail
cd "$(dirname "$0")/.."
system="$(uname -s)"
case "$system" in Darwin|Linux) ;; *) echo 'Use setup.ps1 on Windows.' >&2; exit 2 ;; esac
install_prerequisites=false
forward=()
for arg in "$@"; do
  if [[ "$arg" == --install-prerequisites ]]; then install_prerequisites=true
  else forward+=("$arg"); fi
done
python_command=''
choose_python() {
  local candidate
  for candidate in python3 python3.14 python3.13 python3.12 python3.11; do
    if command -v "$candidate" >/dev/null && "$candidate" -c 'import sys;sys.exit(sys.version_info<(3,11))' 2>/dev/null; then
      python_command="$(command -v "$candidate")"; return 0
    fi
  done
  return 1
}
missing=()
choose_python || missing+=(python@3.11)
if ! command -v node >/dev/null || ! node -e 'if(+process.versions.node.split(".")[0]<22)process.exit(1)' 2>/dev/null; then missing+=(node@22); fi
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then missing+=(ffmpeg); fi
command -v git >/dev/null || missing+=(git)
if ((${#missing[@]})); then
  if [[ "$system" == Linux ]]; then
    echo 'Missing prerequisites. Ubuntu needs Node 22+, Python 3.11+ with venv, Git, FFmpeg and Chromium system libraries. See docs/installation.md. System packages are not installed automatically.' >&2; exit 2
  fi
  if ! $install_prerequisites; then
    echo "Missing prerequisites: ${missing[*]}. Re-run with --install-prerequisites to use an existing Homebrew installation." >&2; exit 2
  fi
  if ! command -v brew >/dev/null; then
    echo 'Install Homebrew from https://brew.sh, then retry. Setup does not install a package manager or request administrator access.' >&2; exit 2
  fi
  brew install "${missing[@]}"
  for formula in node@22 python@3.11; do
    if prefix="$(brew --prefix "$formula" 2>/dev/null)"; then export PATH="$prefix/bin:$PATH"; fi
  done
  choose_python || { echo 'Python 3.11+ was not found after installation.' >&2; exit 2; }
fi
exec "$python_command" scripts/install.py "${forward[@]}"
