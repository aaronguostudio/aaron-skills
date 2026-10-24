# Versions and updates

Aaron Skills installs a matched set of Demo skills and local tools. New clean
installations check for stable releases in the background when a skill starts
a task or a Demo operation finishes. Checks normally run at most once a day.
There is no always-running service, scheduled job, account or telemetry.

Compatible stable patches install automatically. Larger changes are announced
with a change summary and need your decision. The running command keeps its
original runtime; activation waits for other Demo commands to finish. Start a
new agent session to discover refreshed skill instructions.

```sh
aaron-demo version
aaron-demo version --json
aaron-demo update check
aaron-demo update check --json
aaron-demo update
```

`update check` only checks. `update` installs a compatible patch, or shows the
changes and the command to accept a larger update: `aaron-demo update --yes`.
Neither command publishes anything or invokes a narration provider. A failed
check reports that the latest version is unknown, not that you are up to date.
Older releases without update assets are also reported as unknown.
Background failures can retry on a later task after an hour. Uninstall disables
background updates, including activation by an updater already in progress;
rerun setup to explicitly reinstall.

## Choose your policy

```sh
aaron-demo update policy compatible
aaron-demo update policy notify
aaron-demo update policy off
aaron-demo update snooze
```

- `compatible` is the default: check, notify, and install eligible patches.
- `notify` checks and reminds you; installation is manual.
- `off` disables automatic checks and notices. Manual checks/updates still work.
- `snooze` postpones available-update reminders for 24 hours, then 48 hours, then
  a week for the same release. It does not change the selected update policy.

Your choice is stored per installation, outside the versioned runtime. Custom
runtime, command and host registration paths survive updates. Local modified
source installations skip automatic checks and installation. Installed file or
registration edits are preserved and block replacement. Maintain custom work in
your source checkout rather than editing an installed release.

`aaron-demo update --background` starts the same nonblocking check used by skill
entry points. It does not wait for a download or prompt. A completed update or a
required decision is announced on a subsequent Demo operation. You can use
`update` to see the changes at any time. Background logs are bounded and stored
under the installation's `updates/` directory. Set `AARON_SKILLS_NO_UPDATE=1` for
offline/CI work; this suppresses automatic work, not explicit manual commands.

## Roll back

```sh
aaron-demo rollback
```

Rollback checks the previous retained runtime before switching, keeps your
current host registrations and user data, and changes the update policy to
`notify`. This prevents immediately reinstalling the version you reverted.
Re-enable `compatible` when ready. Both directions refuse activation while a
Demo command is running. Missing or modified files in the target version require repair;
rollback will not invent a replacement. No release directories, recordings,
sessions, voice profiles or credentials are deleted.

The first installation has no rollback target. Existing users need to fetch this
implementation and rerun setup once; an old installation cannot acquire an
updater without that initial upgrade. Native Windows updater execution requires
the Windows CI/acceptance checks; local macOS checks alone do not certify it.

## Release eligibility and provenance

Automatic installation requires **all** of the following:

- A published, non-prerelease GitHub Release from the official repository,
  with the update descriptor and its named archive attached to that release.
- A strictly newer stable `major.minor.patch` version, within the same major
  **and minor** series as the installed version (including `0.x`).
- An explicit `compatible` declaration and the same compatibility epoch.
- A clean installed source and an archive whose checksum, file hashes, content
  identity, version, commit and update declaration all match the descriptor.
- Successful dependency preparation and doctor checks, managed registrations,
  and no active Demo task at the activation checkpoint.

A version number by itself never grants automatic-update eligibility. A changed
compatibility epoch, a new minor/major series, or a `review` declaration requires
manual acceptance. Releases before this contract have no known epoch and require
review. The updater downloads stable release assets, never a moving main branch.

Update requests send ordinary public GitHub requests (including normal network
metadata such as IP and User-Agent). They send no project path, recording,
credentials or usage events. Package installation may contact the same dependency
registries as setup. TLS and the official release account are the trust boundary;
checksums bind the archive to the descriptor, not to an independent signing key.
On macOS, an empty Python CA store can use `/etc/ssl/cert.pem` without changing
system files or disabling TLS verification. Explicit `SSL_CERT_FILE` or
`SSL_CERT_DIR` settings take precedence. Certificate failures keep the latest
version unknown and show certificate-recovery guidance.
See [installation](installation.md) and [data behavior](data-and-network-behavior.md).
