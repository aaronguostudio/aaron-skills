# Complete workflow release v1.0.0

The standard installation now registers seven skills: Shape, Build, Verify,
Capture, Film, Deliver and Share. Existing `aaron-demo` commands and the local
media workflow retain their identities. A rollback to a smaller skill set retires
only unchanged managed registrations; user replacements block activation.

Release acceptance requires the complete source gate, an isolated exported
installation, doctor and the installed capture/revision/media/clipboard flow,
update/rollback and lifecycle checks. The version-tag native matrix covers the
exact release revision on macOS 15, Ubuntu 24.04 and Windows Server 2022 with
Node 22 and Python 3.11. See the [release](https://github.com/aaronguostudio/aaron-skills/releases/tag/v1.0.0)
and [CI runs](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml)
for its final remote results. Historical records below retain their original scope.

Verify and Deliver had synthetic development trials covering report arithmetic,
scoped repairs and dependent exports, repeated template output and invalid-input
preservation, recipient files/access, draft release status, a local fake send with
uncertain acknowledgment, read-only checks and missing historical references.
One recipient reuse failure led to explicit package-only replay guidance. A later
replay needed an evaluator staging correction to supply the original historical
fixture; it is assisted evidence, not an independent clean pass or a causal
old/new improvement measurement. A missing-reference control correctly retained
an unverified historical-identity claim without a substitute baseline.

These trials and installed checks do not certify universal model quality, human
preference, third-party framework integration, real messaging connectors or
customer acceptance. Raw trials, generated media, authentication and machine
paths remain outside Git. Native discovery is host/version-specific; registration
alone is not proof of model selection on every target host.

---

# Ubuntu setup and capture fixes — v0.4.1 candidate

Date: 2026-10-21. Local evidence uses public/synthetic fixtures only.

- The complete macOS arm64 source gate passed: TypeScript, 257 capture unit tests,
  133 renderer tests, Python/privacy/document checks and 20 real Chromium capture
  integration tests. Windows-only checks remain platform-specific.
- A fresh isolated exported installation passed doctor and Capture -> MP4 -> HTML
  smoke. The installed professional template rendered with stills and a cover;
  its H.264/AAC output fully decoded. Cover, body and delivery-page inspection
  confirmed readable output with no default placeholder branding.
- An Ubuntu x64 container under ARM-host emulation used Node 22.22.2 and Python
  3.12.3. Eight setup/display tests passed. Real Chromium launch reproduced the
  absent-display error with the new recovery message, launched headless without a
  display, and launched headed under Xvfb. This focused probe used Playwright
  1.62.1 with the browser supplied by the Playwright 1.61.1 container image; it
  does not establish a full pinned-browser Ubuntu workflow or native hardware
  certification. Exact-platform CI supplies separate release evidence.
- No narration provider/account calls or changes to authentication policy were
  needed. First-session sign-in and `--headed` still need a display; smoke uses
  a private empty fixture session and does not test interactive sign-in readiness.

---

# Brand and layout v2 — local implementation verification

Date: 2026-10-19. This is a local candidate, not a published release. Tests use
entirely synthetic Northstar artwork and a generated form recording. No client
assets, documents, adapters, credentials or browser state enter public source.
Raw media and logs stay in the external `video-layouts-v2-2026-10-19` archive.

- Presentation v1/plain/legacy defaults remain compatible. V2 adds explicit logo
  provenance/fallbacks, raster decode and visibility checks, light/dark variants,
  wordmark handling, shared palettes, page-level transcripts and four screen placements.
- The full source gate passed: strict TypeScript, 256 capture units, 106 renderer
  tests (including 12 new v2 cases), Python/privacy/import/document checks and
  20 real Chromium capture integration tests. The Windows-only ACL assertion
  remains skipped on macOS. The final branding/theme changes also passed focused
  tests. Website build/cover tests and Sites checks passed for the shared cover view.
- An isolated exported installation passed doctor and Capture -> H.264 -> HTML
  smoke. Identical pinned browser binaries were copied into the isolated cache;
  the ordinary user's active installation was not replaced or modified in place.
- Installed media acceptance renders top/bottom/left/right layouts in native and
  fixed canvases, with transparent wide wordmarks, imported local tone/transcript,
  waits and multiple focus boxes. Videos fully decode. Pixel assertions verify
  actual logos on cover/body/outro and scaled/translated focus borders. Input
  recording, capture/steps and imported audio hashes remain unchanged.
- Cover/content previews render without an MP4 or provider synthesis. Existing
  template/covers/imported-tone and mocked-provider acceptance also passed.
  Mock requests and tones are plumbing checks, not voice quality acceptance.
- The first real smoke recording started white and lacked the required black-to-white
  sync transition. The renderer refused it. It was retained and inspected; a separate
  fresh smoke passed without a calibration override or guard change. This retry does
  not establish the cause of the missing initial marker or claim a capture fix.

V2 has local macOS arm64 evidence. The CI matrix is configured to repeat the new
installed verifier; its Windows/Linux results have not run for this local branch.
Brand-source metadata records agent/user evidence, not automatic identity detection;
contrast pixels are a heuristic, not human brand acceptance. Transcript pages use
measured clip duration, not inferred word timestamps. Agent coverage instructions
are not evidence that every host/model will follow them on an unseen task.
No provider spending, global runtime upgrade, push, merge, tag or deployment occurred.

---

# Presentation cover presets — v0.2.0 candidate

Date: 2026-10-19. The local release checks ran on macOS arm64 with the pinned
runtime. Synthetic content and logos were used; raw media and QA logs stay
outside Git. No live narration or new image-generation calls were used for these
checks.

- Shared source checks passed, including strict TypeScript, 94 renderer tests,
  capture units, Python suites, privacy/import/document closure and 20 real
  Chromium capture integration tests. Skill structure validation passed.
- An isolated exported installation passed doctor and the real capture-to-video
  smoke. The installed presentation verifier renders the three existing video
  templates and two standalone library presets, fully decodes the videos and
  checks PNG/WebP dimensions and custom background colors. Imported tone and
  mocked narration remain separate from live provider acceptance.
- All 32 presets were reviewed in the browser with English, long titles and CJK,
  maximum optional field lengths, square/wide logos and palette changes.
  Independent cover and video-opening renders were visually reviewed. Reusing
  the presentation retained the original capture/evidence hashes.
- Website build, cover asset/handoff tests and Sites export checks passed.
  Browser acceptance covered 32 styles, bilingual search, family filters,
  modal Escape/focus, direct style links, retained content and Logo across
  styles, clipboard brief, configuration download and 390px mobile layout.
  No browser errors, field overflow or network writes were observed. A downloaded
  website configuration was rendered by the exported runtime to 1600x900
  PNG/WebP, confirming the browser-to-agent handoff.
- The 32 original gallery PNGs remain byte-identical. Runtime WebP artwork is
  explicitly hash-reviewed; unknown/changed binary assets and secret-bearing
  metadata still fail the source scanner. Root/runtime/website dependency audits
  and the independent website-source secret scan reported no findings.

The exact commit's remote CI results are available in the
[three-platform matrix](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml).
This local record does not certify new native LLM-host combinations or the quality
of an agent's recommendations for an unseen brief. Human brand/style acceptance
and live narration remain separate from deterministic and fixture checks.

---

# CI identity and Windows media prerequisite repair

Date: 2026-10-19. This repair preserves existing Git history and accepts ordinary
commit emails and GitHub-generated merge identities. Public-source/reachable-blob
privacy checks and the independent Gitleaks history scan remain required.

The earlier Windows main run [39271773720](https://github.com/aaronguostudio/aaron-skills/actions/runs/39271773720)
reported a Chocolatey feed HTTP 503 and installed 0/0 packages, but continued.
Its sync-fixture test skipped because ffprobe could not run; real capture then
failed with a misleading missing-marker error. Windows setup now retries bounded
installation attempts and requires both FFmpeg executables to launch before tests.
A package-manager success alone is insufficient. Required media tests do not skip.

Local macOS checks cover ordinary-email/GitHub-merge acceptance, deleted private
history rejection, secret tripwires, missing ffprobe, invalid media and a valid
recording without a marker. Genuine sync-offset detection remains mandatory.
The complete shared source gate passed, including 256 capture units, 84 renderer
tests, Python suites and 20 real Chromium tests. Fresh isolated installation,
doctor, real capture/render smoke, MP4 decode, playback and clipboard checks passed.
The smoke frame was visually reviewed. Source
and Git-history Gitleaks scans and all three dependency audits found no issues.
Native Windows setup retry/exhaustion tests run in the Windows CI job. Consult
[the current CI matrix](https://github.com/aaronguostudio/aaron-skills/actions/workflows/ci.yml)
for each exact revision. This dependency failure does not establish the cause of
any separate other-machine recording failure.

---

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
runs on version tags or explicit manual dispatch, using Node 22 and Python 3.11
on macOS 15, Ubuntu 24.04 and Windows Server 2022. Ordinary pushes/PRs keep only
the public-source/history and secret boundary checks. Daily runtime and website
acceptance is local; see [local development](local-development.md).
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

## v0.3.0 video collection

The macOS local candidate adds six matched cover/body art directions and two
unframed treatments. Unit checks exercise all sixteen composition presets at
three recording aspect ratios, uncropped geometry, short captions, transcript
pagination, palette precedence and verified logo variants. Version-1 defaults
remain unchanged. The installed synthetic media verifier also exercises the two
plain treatments with imported tone/text, without calling a voice provider.

The public Forma examples use synthetic people, projects and activity in a
frontend-only prototype. Six approved studio cuts and two plain cuts were fully
decoded; the eight seekable MP4s and thirty image assets were delivered with
reviewed hashes. The gallery was checked in English/Chinese on desktop and
visually at 390px in a browser frame; this is not a physical-phone certification.
The previews are silent; transcript mode demonstrates saved step notes, with
actual narration text supported by the imported-audio contract. No client screens,
raw capture, session or provider configuration is included in public source.

Shared deterministic checks, website build/Sites checks, dependency audits and
independent secret scanning passed locally. Remote CI and production provenance
are separate release gates; the local evidence does not claim their outcome.

## v0.6.0 optional masking

Local macOS arm64 checks cover the shared source gate, explicit mask contract
validation in Python and JavaScript, source-clock timing through calibration,
holds, waits and gaps, and add/preserve/remove revisions with unchanged raw media.
A fresh exported installation passed doctor and capture -> render -> Share smoke;
pixel checks cover the actual MP4 stills, body preview and embedded Share image.
A scaled version-2 body preview and a mask-removal preview were also checked.

Ten prompted decision cases passed for internal/mock/Dev/unspecified demos,
explicit requests, project rules, public real-data context, later additions,
user corrections and a clearly exposed live credential. These are isolated
classifications with accepted presentation choices, not native discovery or
complete autonomous recording tasks. The release-specific native matrix remains
separate evidence and is linked from the GitHub Release notes.

The runtime provides explicit solid rectangles. It does not detect all sensitive
data, track moving content or blur pixels. Raw captures, screenshots and manifests
remain unredacted; captions, cover text and audio require the same scoped review.
