# Blog benchmark v0

A repeatable baseline for the three existing Demo skills on Aaron Guo's real,
public, bilingual blog. This benchmark does not improve the skills or runtime.

See the [measured v0 baseline](results/baseline.md), [machine-readable results](results/baseline.json)
and [trial metrics](results/trials.csv). Raw media and host transcripts stay in a
private archive outside Git; the report records its archive ID and evidence hashes.

Cheap scorer/proxy boundary tests run in the shared deterministic check. Native
model executions remain explicitly opt-in via the runner, never ordinary CI.

The frozen [case](case.json), [task brief](tasks.md) and [100-point rubric](rubric.json)
are separate. Execution hosts receive the task and source, never the rubric. A result
is a baseline observation, not proof of improvement or universal skill benefit.

## Reproduction

Use a new absolute workspace outside all Git repositories. The blog repository must
contain the case's committed revision and have its locked dependencies prepared.
The local developer's uncommitted blog changes, credentials and `.env` are excluded.

```sh
python3 benchmarks/blog-v0/prepare.py --blog-repo <blog-checkout> --workspace <new-workspace>
# In <new-workspace>/blog, build, then start and keep running:
NODE_ENV=production node node_modules/nuxt/bin/nuxt.mjs build --preset node-server
# On the measured macOS arm64 environment, Nitro omitted a locked native dependency.
# Copy the already installed dependency into the generated server bundle if absent:
cp -R node_modules/.pnpm/@libsql+darwin-arm64@0.4.7/node_modules/@libsql/darwin-arm64 .output/server/node_modules/@libsql/
HOST=127.0.0.1 PORT=4190 node .output/server/index.mjs
# From the exact Skills source revision being evaluated:
python3 scripts/install.py --agent codex --root <new-workspace>/runtime --skills-dir <new-workspace>/registration/.agents/skills --bin-dir <new-workspace>/bin
<new-workspace>/bin/aaron-demo doctor
# Warm up /blogs, the target English article and its Chinese counterpart before timing.
python3 benchmarks/blog-v0/run.py --workspace <new-workspace> --trial 1
python3 benchmarks/blog-v0/run.py --workspace <new-workspace> --trial 2
python3 benchmarks/blog-v0/run.py --workspace <new-workspace> --trial 3
```

Each trial gets a fresh adapter directory, browser session directory and native Codex
invocation, with the same requested model/effort. Source/skill/runtime files are read
only for the task. The host has normal local tool access, **not an adversarial sandbox**.
The local target and prohibition on external requests/writes are part of the task;
the Demo browser guard remains enabled. There is no production deployment, real sign-in
or paid narration. Do not run trials concurrently: machine contention affects timing.

Use the production build, not Nuxt dev: dev HMR can introduce a `localhost/ws`
connection even when the page uses `127.0.0.1`. An initial dev-server preflight was
stopped and retained separately when the unchanged host guard correctly refused
that connection. It is an infrastructure exclusion, not a hidden successful trial.

## Offline artifact-quality profile

The strict profile's loopback restriction can stop the real application on external
icon/embedded-video dependencies before any guided step. Preserve those integration
results. A separately frozen [offline profile](profiles/offline.json) measures the
remaining workflow without changing any skill/runtime code: run the same production
server on port 4192, then use the local header proxy on 4190.

```sh
# In the prepared blog snapshot:
HOST=127.0.0.1 PORT=4192 node .output/server/index.mjs
# From this repository, in a separate terminal:
python3 benchmarks/blog-v0/offline_proxy.py --workspace <workspace>
python3 benchmarks/blog-v0/run.py --workspace <workspace> --profile offline --trial 1
python3 benchmarks/blog-v0/run.py --workspace <workspace> --profile offline --trial 2
python3 benchmarks/blog-v0/run.py --workspace <workspace> --profile offline --trial 3
```

The proxy adds `connect-src 'self'; frame-src 'none'` CSP to the application. It
does not alter the source or fabricate UI results. External icon fallback fetches
and third-party embedded video are excluded; search, local articles/images and
language controls remain actual application behavior. A read-only HTTP review
namespace serves only generated offline-trial HTML/media under `artifacts/`, never
session state, raw logs or arbitrary filesystem paths. The original strict-profile
files are not served there. The proxy and upstream bind only to loopback.

The profile is test-environment preparation, **not a skill improvement**. Never
compare its score against the strict profile to claim a gain. Future old/new skill
comparisons must use the same fixture profile, protocol and review conditions.

Three repetitions are a small descriptive sample. Model responses and rendered videos
need not be byte-identical. Record CLI/model settings, dependency/runtime fingerprints,
server mode and deviations. Do not silently replace a failed trial, tune the task after
seeing its score, or conflate setup time with agent execution time.

## Evidence and scoring

Keep raw prompts, events, local paths, recordings, screenshots, generated pages and
review images **outside Git**, as required by the capture contract. Commit sanitized
metrics, scores, hashes and review notes under `results/`. The local workspace is the
evidence archive; preserve it to audit a score. SHA-256 hashes identify artifacts but
are not a substitute for retaining them.

Apply safety gates first, then item scores. Unreviewed items are null. Automatic file,
decode and reuse checks and manual visual/editorial review remain distinct. Review
every held frame and wait ending. Check the HTML's images, video and text copy in a
real browser. Test portability by copying the complete handoff folder to a new path.
The operator reviewer can see the output source/version: this is unblinded review,
and owner style acceptance remains separate.

Use the installed Bun to extract held frames and every frame of each wait's final
second for independent review. The helper checks the actual MP4 duration against
the default silent timeline; it does not alter the captured or rendered evidence.

```sh
<installed-bun> benchmarks/blog-v0/review_frames.mjs <installed-runtime> <passed-run> <new-review-dir>
python3 benchmarks/blog-v0/collect.py --trial <trial-dir> --out <new-evidence.json>
python3 benchmarks/blog-v0/score.py <review.json>
```

File/decode collection does not assign visual scores. Retain both the native
execution's own checks and the operator's subsequent review, including any rejected
takes and blocked browser checks. A portable handoff must survive moving the complete
handoff folder; existing references in the original artifact tree are insufficient.

If integration blocks the workflow before a passed capture exists, report completion
as failed/blocked and downstream stages as **not exercised**. Do not give the renderer
or handoff a zero-quality rating for artifacts that could not be produced, and do not
invent an overall quality score. Preserve the missing-evidence reasons as null review
decisions; completion and blocked-stage counts remain valid baseline measurements.

For future iterations, repeat the same protocol against the old and new versions;
report completion, quality totals, median/range of elapsed time, attempts and manual
interventions. If the protocol or fixture changes, assign a new benchmark version.
No-tools and tools-only ablations can be added separately; the v0 baseline alone
cannot isolate the instruction files' contribution from the shared tools.

## Case library

The blog is the first **public, no-login** case. It cannot certify authentication,
session expiry or business-write recovery. Reserve separate cases for:

1. Human sign-in to a dedicated test account, saved-session reuse and expiry.
2. A seeded write-capable fixture with independent save/approve counters, especially
   expiry after a successful write and confirmation that no write repeats.

For login cases, separate human sign-in wait from agent execution time; reset account
and session state between trials. A session file is never an artifact to share. The
write case must compare independent application counters before and after a
presentation-only revision, and after expiry recovery. A read-only blog cannot cover
those checks. These cases are planned, with no new authenticated-site certification.

Never add customer accounts, session state or credentials to the benchmark repository.
The existing synthetic invoice/sign-in checks remain complementary technical evidence,
not results of a real authenticated-site benchmark.
