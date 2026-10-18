# Blog Benchmark v0 — baseline

Measured on October 17, 2026 (Edmonton; executions October 18 UTC). **No Demo skill
or runtime improvement was made.** This establishes the comparison point for later
changes, using Aaron Guo's real blog source in an isolated local environment.

## What was tested

Each native Codex invocation started without a project adapter and explicitly used
`demo-capture`, `walkthrough-video`, and `paste-ready-update` to:

1. Show the English Writing index, search for **The One-Person Project**, open it,
   then use the language control to open **一个人的项目**.
2. Render a silent guided MP4. Afterward, change the final caption to **Read the
   Chinese edition** and select the saved Chinese heading highlight, preserving
   the original and reusing the recording.
3. Produce an English teammate handoff with four screenshots and the revised video,
   accurately described as local verification, with nothing published or sent.

The task, case, and rubric were frozen before formal executions. Quality has a
fixed 100-point denominator: correctness 35, clarity 25, handoff 25, revision 15.
Safety gates precede scoring. Time, attempts, tokens, and interventions are separate
efficiency observations. Setup, installation, content selection, build, warm-up,
and the operator's subsequent review are outside the task timer.

## Results: preserve the two environments separately

| Profile | End-to-end task completion | Quality | Agent elapsed time | Capture / render attempts |
| --- | --- | --- | --- | --- |
| Strict integration, trial 1 | Blocked | Not exercised | 157.85 s to incomplete handoff | 1 / 0 |
| Strict integration, trial 2 | Blocked | Not exercised | 176.39 s to incomplete handoff | 1 / 0 |
| Strict integration, trial 3 | Blocked | Not exercised | 206.54 s to incomplete handoff | 1 / 0 |
| Offline artifact quality, trial 1 | Complete | 95 / 100 | 265.43 s | 1 / 2 |
| Offline artifact quality, trial 2 | Complete | 95 / 100 | 395.25 s | 3 / 3 |
| Offline artifact quality, trial 3 | Complete | 100 / 100 | 279.05 s | 1 / 2 |

All formal executions ended with CLI exit 0 and no operator intervention during the
task. Exit 0 means the host finished; it does **not** mean the requested task passed.
No safety-gate violation was observed. The host had normal local tool access; this
was not an adversarial isolation test.

The strict profile completed **0/3**. The unchanged capture guard stopped an external
`GET api.iconify.design/heroicons.json` request before the first guided step. There
was no passed walkthrough or presentation revision to score. Null quality records
preserve that missing evidence rather than assigning invented downstream scores.
Two trials added an origin-bound forbidden-read rule; its “read that writes” error
label does not establish that the icon GET is a business write.

After retaining those results, the separately frozen offline profile added a local
response-header policy, `connect-src 'self'; frame-src 'none'`, to exclude external
icon fallback requests and third-party embeds. Source, search, local images,
articles, language controls, skills, task, and rubric stayed the same. Fallback icon
text remains visible in the menu. **This environment adjustment is not a skill
improvement, and the two profiles are not an old/new quality comparison.**

The offline profile completed **3/3** with a median score of **95**, range **95–100**,
and median execution time of **279.05 seconds (4m 39s)**, range 265.43–395.25 seconds.
These are descriptive results from three runs, not a reliability estimate.

| Offline trial | Correctness / 35 | Clarity / 25 | Handoff / 25 | Revision / 15 | Revised video |
| --- | --- | --- | --- | --- | --- |
| 1 | 35 | 25 | 20 | 15 | 30.233 s |
| 2 | 35 | 25 | 20 | 15 | 29.967 s |
| 3 | 35 | 25 | 25 | 15 | 30.567 s |

The deduction in trials 1 and 2 is concrete: the complete handoff folder references
`../revised-run/walkthrough.mp4`. It works in the original artifact tree, but moving
that folder alone leaves the video missing. Trial 3 copies the MP4 into its handoff
folder and remains playable after relocation. Portable-package success: **1/3**.
All three original HTML handoffs loaded four images, played the revised video, and
copied the expected plain text in Chrome.

## What the runs exposed

| Priority after baseline review | Observed evidence | Improvement to evaluate next |
| --- | --- | --- |
| P1 — complete handoff package | Two of three final handoff folders lose the video when moved; a normal reference-exists check passed at the original location. | Make a self-contained package the default; validate references after copying the complete package to an isolated directory. Repeat all three tasks with the same rubric. |
| P1 — capture and recorded-frame readiness | Trial 2 first waited on lazy images below the viewport. Its second capture passed UI assertions but rendered two blank held wait frames. Its third capture repaired actual recorded transitions and was accepted. | Provide a bounded visible-content readiness pattern and verify recorded wait endings before rendering/handoff. Measure captures, first visually acceptable take, and elapsed time as well as final quality. |
| P1 — host-policy integration | All strict trials stopped on the external icon request. All six formal trials initially used the documented host-and-port form, which the installed validator refused. | Reconcile host-policy documentation and schema; give explicit dependency diagnostics and an authorized fixture/dependency setup path. Preserve network guards and keep strict integration results separate from offline quality. |
| P2 — CLI discovery | Native runs encountered unsupported render-help/option discovery while finding the correct installed command. | Make supported flags and help easy to discover; track failed commands under an unchanged task. |
| P2 — revision provenance | Accepted capture manifests report `appRevision: unknown`; the outer fixture supplies a verified pinned source revision instead. | Let adapters expose revision provenance without a project-specific shell assumption; retain the outer fixture hashes as independent evidence. |

Presentation-only revision already worked in **3/3** offline trials: raw recording,
capture manifest and screenshot hashes match their accepted originals, preceding
steps remain unchanged, and no new capture occurred after feedback. All three final
captions actually changed. Trial 1 also narrowed a broad title-block focus to the
saved heading; trials 2 and 3 already had heading geometry and selected it again.
This does not establish every possible revision or write-recovery behavior.

Trial 2's failures were not discarded. Capture 1 failed, capture 2 passed assertions
but failed visual review, capture 3 supplied the accepted evidence. Its three
captures and three renders remain in the time and attempt totals. Final quality
describes the accepted final deliverable; recovery cost is reported separately.

## Evidence and review

[Machine-readable results](baseline.json), [trial metrics](trials.csv), and
[per-trial decisions](reviews/offline-trial-1.json) retain scores, missing-evidence
reasons, core artifact hashes, and protocol fingerprints. The private archive ID is
`blog-v0-2026-10-17`; artifacts and raw transcripts remain outside Git. A hash is an
identifier, not a substitute for keeping the archive.

The operator independently reviewed every held frame of the six accepted videos
(66 frames; byte-identical preceding frames reused for comparison), plus all 30 fps
frames from the last second of each of their three wait steps (540 frames). Full-size
held frames were used for text/highlight review and contact sheets for wait endings.
Both rejected blank held frames from trial 2 were also inspected. All six accepted
MP4s fully decoded and had no audio stream. Frame extraction used the installed
silent renderer's timeline with a duration check; this is not continuous human
playback of every video.

Real Chrome actions confirmed image load, video playback advancing, and immediate
plain-text clipboard equality for all three final pages. A copied trial-3 handoff
was additionally opened and played. Rich clipboard behavior, actual pasting into
Teams/Outlook, and owner style acceptance remain untested/pending.

The reviewer was a Codex operator separate from each native execution, unblinded to
source/version. This is agent review, **not Aaron's human acceptance**. The task uses
an explicit skill request; it does not certify automatic routing or isolate skill
instructions from the tools. No no-tools/tools-only ablation was run.

## Reproducibility and exclusions

- Skills source: `1fec24692744dcb6bc8eaae91301e03b5e29a5ba`; installed Demo bundle
  `2df24889e2e4354b`, initially clean. All 71 installed bundled files still match.
- Blog source: `0c51dc56cebf9f972a63a124ad65c8e356b9c3b5`, exported from committed
  Git content. All 522 tracked snapshot files match, apart from the documented,
  hash-checked config overlay disabling analytics and dev font downloads. The
  developer's dirty checkout and credentials were not copied or modified.
- Codex CLI `0.163.0-alpha.10.2`, requested `gpt-6.1-sol`, reasoning `high`; ephemeral
  execution with user configuration ignored. Same settings in all formal runs.
- macOS 26.6 arm64; installed runtime Node 24.18.0/npm 11.16.0, Bun 1.4.3,
  Python 3.14.5, FFmpeg 8.1.1. Blog Nuxt 3.17.2, Nitro 2.11.11, Content 3.5.0.
  This is not a Windows/Linux or multi-host benchmark.
- Nuxt production `node-server`, not HMR. An initial dev-server preflight was stopped
  after a `localhost/ws` refusal (91.44 seconds, one operator stop); excluded from
  formal aggregates and preserved. Offline fixture preflight is also setup only.
- The generated Mac server bundle omitted locked `@libsql/darwin-arm64` 0.4.7;
  its existing locked package was copied into generated server dependencies. This
  is recorded build preparation, not an application or skill fix.
- Installed runtime, dependency preparation and warm-up were outside timed tasks.
  Token totals in the CSV are cumulative reported input/output, with cached input
  included in input; do not add cached input again or interpret these as dollar cost.
  First-passed-capture latency was not instrumented consistently and is null.

For an improvement claim, keep this fixture, task, rubric, model/effort and review
conditions fixed, run old and new versions with fresh adapters in paired/repeated
trials, and compare completion and safety before quality, attempts and time. Include
an unseen article/task to test transfer; the reserved holdout has not been run. If
fixture or task changes, version the benchmark and keep this baseline.

## Next cases in the library

The blog covers a real **no-login** workflow. Add separate benchmark cases for
human sign-in to a dedicated test account, session reuse and expiry; then a seeded
write-capable fixture with independent save/approve counters and expiry after save.
Record human sign-in wait separately, reset sessions/accounts between trials, and
verify that recovery and presentation revisions do not repeat writes. Keep customer
accounts, credentials and session state out of shared evidence. These cases are
planned, not executed or certified by this baseline. Existing synthetic tests remain
separate evidence.
