// Filesystem privacy boundary. POSIX mode bits are not Windows access control.
import { chmod, mkdir, link, unlink, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

export async function privatePath(path, directory = false) {
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', resolve(import.meta.dirname, '../../../../scripts/private-path.ps1'), '-Target', resolve(path),
      ...(directory ? ['-Directory'] : [])], { stdio: ['ignore', 'pipe', 'pipe'] })
  } else {
    await chmod(path, directory ? 0o700 : 0o600)
  }
}

export async function privateDirectory(path) {
  const made = await mkdir(path, { recursive: true, mode: 0o700 })
  if (made && process.platform === 'win32' && resolve(made) !== resolve(path)) await privatePath(made, true)
  await privatePath(path, true)
}

export async function publishLock(path, pid) {
  const pending = `${path}.pending-${pid}-${randomUUID()}`
  try {
    await writeFile(pending, String(pid), { flag: 'wx', mode: 0o600 })
    await privatePath(pending)
    // Publish a complete PID atomically. An empty just-created lock must never
    // be mistaken for a dead writer by another process.
    await link(pending, path)
  } finally {
    await unlink(pending).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
}
