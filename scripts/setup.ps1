# Native Windows bootstrap. All arguments are forwarded to the shared installer.
# System packages, PATH, execution policy and administrator settings are unchanged.
$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Set-Location (Split-Path -Parent $PSScriptRoot)
$python = $null
foreach ($candidate in @('python', 'python3', 'py')) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if (-not $command) { continue }
    & $command.Source -c 'import sys;sys.exit(sys.version_info<(3,11))' 2>$null
    if ($LASTEXITCODE -eq 0) { $python = $command.Source; break }
}
if (-not $python) { throw 'Install Python 3.11+ first, then retry. See docs/installation.md.' }
& $python scripts/install.py @args
exit $LASTEXITCODE
