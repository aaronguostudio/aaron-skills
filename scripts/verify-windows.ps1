# Native Windows acceptance in an explicit isolated workspace. No global skills,
# system packages, model calls, accounts or paid narration are changed.
param([Parameter(Mandatory=$true)][string]$Workspace)
$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Set-Location (Split-Path -Parent $PSScriptRoot)
$python = (Get-Command python -ErrorAction Stop).Source
$root = Join-Path $Workspace 'runtime'
$skills = Join-Path $Workspace 'project/.agents/skills'
$bin = Join-Path $Workspace 'bin'
$env:DEMO_CAPTURE_HOME = Join-Path $Workspace 'sessions'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $root 'browsers/playwright'
function Run([string]$Tool, [string[]]$Items) {
    & $Tool @Items
    if ($LASTEXITCODE -ne 0) { throw "Failed: $Tool $Items (exit $LASTEXITCODE)" }
}
Get-ChildItem $PSScriptRoot/*.ps1 | ForEach-Object {
    $tokens = $null; $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
}
Run $python @('scripts/install.py', '--agent', 'codex', '--root', $root, '--skills-dir', $skills, '--bin-dir', $bin)
$release = (Get-Content -Raw (Join-Path $root 'active.json') | ConvertFrom-Json).release
Run (Join-Path $bin 'aaron-demo.cmd') @('doctor')
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
Run $npm @('ci')
Run $npm @('ci', '--prefix', 'packages/demo/capture')
Run $npm @('ci', '--prefix', 'packages/demo/remotion')
Run $python @('scripts/check.py', '--python', (Join-Path $release '.venv/Scripts/python.exe'))
Run node @('scripts/verify-installed.mjs', $release)
Run $python @('scripts/verify-lifecycle.py', '--root', $root, '--skills-dir', $skills, '--bin-dir', $bin)
Run (Join-Path $bin 'aaron-demo.cmd') @('doctor')
Write-Output "Native Windows acceptance passed. Evidence workspace: $Workspace"
