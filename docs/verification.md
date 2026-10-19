# Demo field-feedback maintenance verification

Date: 2026-10-19. Local checks used macOS arm64, Node 24.18.0, Python 3.14.5
and the pinned runtime dependencies. This record covers the maintenance changes
below; prior platform and host-task evidence remains dated separately.

- Shared source gate passed: 256 capture units, 84 renderer/timeline/narration
  tests, Python tooling/page/benchmark/Shape suites and 20 real Chromium tests.
  The Windows-only DACL test was skipped on macOS. The final installer regressions
  were rerun after PowerShell retry quoting changed (11 tests passed).
- An isolated exported installation registered all three skills for Cursor and
  passed doctor and the real Capture -> silent H.264 MP4 -> HTML smoke. Injecting
  a post-activation smoke failure retained the active runtime/registrations,
  reported the workflow as unverified and left doctor passing.
- Synthetic browser cases covered nested scrolling, a control clipped by its
  scroll container while inside the browser viewport, visible sticky controls,
  settling bounds and duplicate locators. An installed recording/render passed
  full MP4 decode and visual review of all four held frames.
- Professional, minimal and showcase renders used synthetic wide, square and
  tall logos. Covers, held frames and full video decode passed review. The wide
  logo retained a 152 by 26 pixel caption mark rather than a tiny square slot.
  The generated Share page was reviewed at desktop and mobile widths.
- Bundle import/document closure, public-source privacy, staged benchmark
  boundaries and skill structure validation passed. Raw evidence stays outside
  Git; no private adapters, customer recordings or live narration calls were used.

Native Cursor discovery/Auto-model behavior and actual Volta/vite-plus installations
were not certified by this run; npm dispatch regressions used synthetic shims.
Windows/Linux native execution was not repeated locally. Consult the current
[three-platform CI run](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml)
for the exact revision's runner results. The original other-machine sync-marker
failure was not reproduced: diagnostics now distinguish an ffprobe inspection
failure from an inspected recording without the marker. Marker validation remains
required; this is not a claim that the original root cause was resolved.

---

# Platform verification — current checkout

Date: 2026-10-17. These checks extend the original macOS-only v0.1.0 acceptance.
Raw recordings, temporary access keys and machine logs are outside the public
source. No customer system, real credentials or live voice synthesis was used.

## Measured runtime environments

| Environment | Tools | Scope |
| --- | --- | --- |
| macOS 26.6 arm64, real hardware | Node 24.18.0, Python 3.14.5, FFmpeg 8.1.1 | Full source and exported-install acceptance; macOS regression |
| Ubuntu 24.04.4 x64 container, emulated on ARM Mac | Node 24.17.0, Python 3.12.3, FFmpeg 6.1.1 | Full source and exported-install acceptance; not native Linux hardware evidence |
| Windows 11 Home x64, build 26200, real NTFS laptop | Node 22.23.3, Python 3.14.2, FFmpeg 9.0.2, PowerShell 5.1 | Full native acceptance under a non-administrator interactive token; no WSL/Bash runtime dependency |

All three used pinned Bun 1.4.3, Playwright 1.62.1 and Remotion 4.0.536.
The final bundled executable fingerprint is SHA-256 of the JSON object mapping
sorted manifest paths under `packages/`, `scripts/` and `examples/` to SHA-256
file hashes, serialized with Python `json.dumps(..., sort_keys=True)`. Docs and
skill prerequisite wording are excluded:

`96a3427b5799e99509deb33f5434ab9aae7012815ca6a3bd131e68da5bd150f0`

## Completed acceptance

- Source gate: 253 capture tests, 68 renderer/timeline/narration/brand tests,
  42 Python tooling tests, 28 page/annotation tests and 19 real Chromium tests.
  Platform-specific skips remain visible: Windows skips POSIX-only mutation
  harness/registration/bootstrap cases; POSIX skips the Windows-only ACL case.
  The additional redirect helper tests and stronger real-browser POST assertion
  also passed on all three platforms.
- Exported runtime: install and doctor; public capture to silent H.264 MP4;
  presentation-only revision in a path containing spaces/Chinese; unchanged raw
  recording and capture metadata hashes; both MP4s decode; original/revised pages
  load images, play video and copy plain text plus HTML to Chromium's clipboard.
- Visual review: all four held frames in each original/revised walkthrough and
  generated pages checked for captions, highlights and the asserted result.
- Headed synthetic fixture sign-in and saved-session reuse on all three systems.
  This tests the login mechanism, not a real identity provider or customer login.
- Recovery: repeated install, upgrade, repair to a separately prepared release,
  failed prerequisites preserving the active release, managed uninstall preserving
  unrelated skills/runtime/data, and reinstall. Windows also ran `setup.ps1` and
  its `.cmd` launcher as an ordinary user.
- Windows privacy and filesystem checks: independently inspected protected DACLs,
  removal of a deliberately added Everyone read ACE, ordinary-user reapplication,
  lock contention, copied-registration rollback and alias/path guards.
- Root/capture/renderer dependency audits and independent Gitleaks scans of
  intended public source and Git history reported no findings.

The [CI matrix](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml)
uses Node 22 and Python 3.11 on macOS 15, Ubuntu 24.04 and Windows Server 2022.
It repeats source checks, fresh exported installation, revision/media/clipboard,
headed synthetic sign-in and recovery. Consult the run for the exact commit;
a recipe or a previous green run is not evidence for a later revision.

## Reproduce platform acceptance

Prepare the three npm dependency sets as in CONTRIBUTING.md, then run the shared
source check and an isolated install. On POSIX, use the commands in the historical
reproduction section below. On Windows, the complete entry point is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-windows.ps1 -Workspace "$env:LOCALAPPDATA/Demo acceptance with spaces"
```

Use an ordinary user and a fresh workspace outside Git; the source gate needs
Pillow via the installed virtual environment. The verifier must not target global
skills or user data. For custom paths, `scripts/verify-lifecycle.py` requires root,
skills and bin under one isolated workspace. Inspect the resulting frames/pages.
Synthetic sign-in drives only the public fixture; it never types real credentials.

New native Codex/Claude invocation on Windows/Linux, Intel/Windows ARM hardware,
other Linux distributions, real voice synthesis and external customer acceptance
remain unverified. Existing macOS host-task evidence below is retained as history;
these platform checks did not rerun LLM hosts or certify new model combinations.

---

# Historical v0.1.0 local launch verification

Date: 2026-10-17. This is local release-candidate evidence, not a public deployment
or a claim of universal skill benefit. Raw recordings and model logs stay outside
Git; no customer system, real sign-in or live voice synthesis was used.

## Results

| Gate | Result |
| --- | --- |
| Public deterministic suite | 249 capture units, 67 renderer/timeline/narration/brand tests, 27 Python tooling tests, 28 page/annotation tests, 19 real Chromium integration tests |
| Static checks | TypeScript strict check, Python/Node syntax, shell syntax, runtime import/document closure and public-source privacy checks |
| Exported installation | Fresh paths with spaces; doctor and capture -> silent H.264 MP4 -> local HTML smoke |
| Codex local | CLI 0.163.0-alpha.10.2; all three installed skills read, 21-step invoice task, two renders and update pages; underlying model not reported by this JSON transcript |
| Claude Code local | 2.1.267, reported model claude-opus-5[1m]; all three skills natively invoked; same complete invoice and revision task |
| Presentation reuse | Each transcript contains one capture invocation; fixture final audit is one save and one approve; derivative raw video/capture metadata hashes equal the original |
| Artifact review | Four 21-step held-frame sets reviewed; MP4s decode; four HTML pages load four images each and play video in Chromium with no page errors |
| Dependency/secret checks | Root/capture/renderer npm audit and independent secret scans of intended public files/history; no detected findings at candidate preparation |

The public suite totals **390 tests**. Additional private experimental-runner tests
are intentionally excluded from the source release. A source scanner is not proof
that no secret can exist. Independent Gitleaks scanning supplements privacy checks.

The native tasks used this executable runtime/skill fingerprint (SHA-256 of the
sorted bundled package/script/skill file hashes):

`a0741a79ddabd3f01a1cfc48f2e10447a8892489e274e0f049b06904e79b4265`

The final candidate updates reporting documentation; the tested executable files
and skill instructions retain that fingerprint. This is one acceptance task per
host with an existing checked adapter, not a benchmark of adapter authoring,
automatic routing, model superiority or general performance.

## Environment

The measured machine is macOS arm64, Node 24.18.0, Python 3.14.5, Bun 1.4.3,
Playwright 1.62.1 and Remotion 4.0.536. The declared minimums are Node 22 and
Python 3.11; the CI recipe targets those minimums. These local checks preceded publication. Remote runs of the minimum-version
recipe are recorded in [GitHub Actions](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml);
consult the run for the release revision for its result. An isolated fresh installation is not an external person's
clean machine.

## Reproduce

Prepare the root and two package dependency sets with `npm ci`, then run:

```sh
npm run check -- --public-history --python <installed-runtime>/current/.venv/bin/python3
python3 scripts/install.py --agent codex --root <new-root> --skills-dir <test-project>/.agents/skills --bin-dir <test-bin> --smoke
<test-bin>/aaron-demo doctor
```

Use separate native host registrations and a new session for each host task.
The realistic public example is examples/invoice-review; its checked 21-step
adapter is evals/fixtures/checked-invoice-walk.mjs. Keep all generated artifacts
outside source repositories. See evaluation.md and releasing.md for methodology.

## Remaining boundaries

Intel hardware, an external clean machine, Linux/Windows and additional
harness/provider combinations are unverified. Voice synthesis is mocked. Human
style acceptance and clipboard behavior in untested browsers are separate.
Private vulnerability reporting is enabled on the public repository. Each release
requires a successful remote CI run for its tagged revision; the release notes
link to that run.
