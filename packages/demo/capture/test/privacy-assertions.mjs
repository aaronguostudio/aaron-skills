import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { stat } from 'node:fs/promises'

export async function privacySnapshot(path) {
  if (process.platform !== 'win32') return (await stat(path)).mode & 0o777
  const literal = String(path).replace(/'/g, "''")
  const script = `$ErrorActionPreference='Stop'; $acl=Get-Acl -LiteralPath '${literal}';
    $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;
    $rules=@($acl.Access | ForEach-Object { @{sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;type=[string]$_.AccessControlType;rights=[int]$_.FileSystemRights} });
    @{identity=$me;rules=$rules;protected=$acl.AreAccessRulesProtected} | ConvertTo-Json -Compress -Depth 4`
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8' }))
}

export async function assertPrivate(path, directory = false) {
  const actual = await privacySnapshot(path)
  if (process.platform !== 'win32') { assert.equal(actual, directory ? 0o700 : 0o600); return }
  const allowed = actual.rules.filter(rule => rule.type === 'Allow')
  assert.ok(allowed.length > 0, `No user access: ${path}`)
  assert.ok(allowed.every(rule => rule.sid === actual.identity), `Another identity can access ${path}: ${JSON.stringify(actual)}`)
}
