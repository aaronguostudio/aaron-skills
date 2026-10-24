# Public and private benchmark boundary

The benchmark framework, scoring rules, reusable improvements and approved public
results belong in this public source repository. Private project material belongs
in separate storage with its own access controls, outside this repository and its
Git history. **Private project benchmarks are currently disabled.** Do not connect
one, read its source to construct a case, or import its adapters, tasks or results.

## Current case policy

Only these source types can be registered in [public-cases.json](public-cases.json):

| Source type | Public case requirements |
| --- | --- |
| `public-blog` | Aaron's public blog; public content only; no account or credentials. |
| `open-source` | Public source URL, pinned revision and license recorded; local fixture with public/synthetic data. Publicly visible source alone is not evidence of a reuse license. |
| `synthetic` | Entirely fictional application, people, organizations and data. Login cases use dedicated seeded test accounts and simulated side effects. No production identity provider or real customer accounts. |

`blog-v0` and the wholly synthetic `onboarding-v0` are registered. Open-source and synthetic login cases are
the next eligible additions, not completed benchmark results. Existing synthetic
runtime tests do not automatically become benchmark cases.

## What can be committed

Commit the general runner, task/rubric for an approved public case, aggregate
metrics, evidence-backed review notes and public-source/runtime fingerprints.
Every benchmark file must also be explicitly included in `bundles/source.json`.
A new directory or a file added to that manifest alone is insufficient: it must
belong to a registered public case or the explicit framework-file allowlist.

Keep raw prompts, model events, execution logs, screenshots, recordings, generated
HTML handoffs, session/cookie state and credentials outside **every** Git checkout.
This includes public-blog and fictional-app execution artifacts: public input does
not make a raw run safe to publish. A fictional app's authored HTML source is allowed;
its generated capture/handoff output is raw evidence. File hashes may identify an
external archive; they do not make its contents safe to publish.

If private evaluations are authorized in the future, their case definitions,
project names, URLs, internal routes, selectors, workflow descriptions, adapters,
commit IDs, scores, review notes and raw evidence stay in an independently private
location. Scores and summaries are not automatically public merely because images
were removed. Any future disclosure needs a separately reviewed, explicitly approved
public artifact. At present, create no private case registry entries or placeholders
with real project identifiers.

## Local and CI enforcement

After cloning, enable this repository's checked-in hook:

```sh
git config --local core.hooksPath .githooks
python3 scripts/benchmark_privacy.py --tracked
# After staging the intended change:
python3 scripts/benchmark_privacy.py --staged
```

On Windows, use `python` if `python3` is unavailable. The hook finds either Python
command and uses only its standard library. Git for Windows supplies its hook shell;
the Demo runtime still has no Bash/WSL requirement. Review any existing custom hooks
before changing `core.hooksPath`; integrate the same check if you maintain a hook chain.
Git does not enable project hooks automatically for a new clone.

The pre-commit hook checks the **complete Git index**, including unchanged files and
force-added ignored files. It reads staged blobs, so a clean worktree replacement
cannot conceal a private staged version. It rejects unregistered benchmark cases,
unlisted benchmark files, raw media/evidence paths, session-shaped JSON, private
classification markers, inline media, personal home paths and common secret formats.
Symlinks and gitlinks are refused. Diagnostics show paths/categories, not captured
credential values or file excerpts.

CI runs the same boundary check on the tracked tree before dependency installation.
The shared deterministic command repeats it, and the public source exporter checks
the candidate files with the same policy. `.gitignore` is only an extra staging
precaution; `git add -f` does not bypass the index check. The benchmark preparation,
runner, collector, proxy and review-frame helper refuse raw workspaces inside Git,
including ignored directories, symlink destinations and linked worktrees.

These checks are accident barriers, not automatic confidentiality classification.
They cannot recognize every proprietary sentence, an innocently renamed internal
selector or every secret format. An approved case can still contain an unsafe edit.
Do not use `--no-verify` or disable hooks to work around a failure. Review the entire
staged diff and intended commit history before any authorized push. CI runs **after
push** and cannot prevent or undo disclosure by that push; it is an additional check,
not permission to upload suspicious files. Existing independent secret scanning
remains required for release. Files outside Git can still be processed by the chosen
model/tool service; project data-use permissions are a separate boundary.

## Adding a public case and improving a skill

1. Select a public/licensed source or create a wholly synthetic fixture; prepare
   dependencies without importing private configurations, `.env` or real sessions.
2. Register its source/data policy, create its case/task/rubric and explicitly list
   only reviewed public files in the source manifest. Never auto-copy a raw run into
   `results/`. Review paths, error text, prose and identifiers in the public report.
3. Freeze a baseline, run with an external workspace, and retain failed takes along
   with successes in a private local archive. For login cases, keep login/session
   wait separate from execution time and reset only the synthetic accounts/data.
4. Commit reviewed public metrics and generic fixes/regression fixtures. Compare old
   and new versions on the same task/model/fixture before making an improvement claim.

The existing [blog baseline](blog-v0/results/baseline.md) remains the starting point;
adding these boundaries does not rerun it or change its frozen task/rubric/results.
