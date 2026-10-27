# Verify review v1 aggregate evaluation

The baseline, initial candidate and final candidate reached the same correct substantive decisions in all four authored synthetic cases. No false blocker, unauthorized source repair, lost source input, or incorrect repaired artifact was observed. This bounded evaluation supports nonregression on these cases; it does not establish statistical superiority or broader readiness.

## Protocol and provenance

The task, hidden rubric, screenshots and source inputs were frozen before execution. Four wholly fictional cases were each run once with the v1.0.0 baseline and initial candidate, using balanced starting-arm order and at most two concurrent sessions. An evidence-trace ambiguity prompted a narrow skill clarification; four fresh final-candidate controls then used the identical tasks, prompts, tools and 240-second budget. All initial sessions and failed commands were retained. There were 12 sessions, zero process timeouts, and zero executor retries. The four adaptive controls are disclosed, not presented as an untouched preregistered comparison.

Each native CLI session used an isolated workspace, its assigned project-local skill, ignore-user-config, ephemeral mode, skipped Git-repository check, danger-full-access sandbox and approval_policy=never. No model override was supplied; actual serving model identifiers were not exposed in retained CLI events/stderr, so exact serving-model equality cannot be independently confirmed. External-provider API-key variables were removed from launch environments; actual HOME was retained for authentication. No external browsing, account/service actions, sends, releases or extra agents occurred in the observed executor actions.

Runtime: codex-cli 0.164.0-alpha.11.1, Node 24.18.0, Python 3.14.5, Playwright 1.62.1. Baseline tag v1.0.0 resolves to commit a56c5eb63a5bd6296d507d4bb74304c577a1365f. Frozen skill-tree SHA-256 values use sorted relative-file/hash JSON with compact separators:

- Baseline: `2e09957fcd7e572946c51675b8696697372bc0e9f75e6e603bedae184a90ae55`
- Initial candidate: `4b2ca5c086572997b82b32528e06f38d8d51e100dfa9bc360be4f9cbf7a2a64a`
- Final candidate: `c298bd39ca2f1a897c2f8a5e8d28b36f8caac2b07f89656bb39e1cb9b0c02ca1`

The final candidate adds explicit guidance that generating a screenshot or measuring DOM geometry does not establish that pixels were viewed. The initial candidate adds UI before/design/after comparison, introduced-versus-inherited attribution, executable-check attribution, and coherent bug-class repair guidance.

## Artifact-based results

All three arms have the same outcomes below. Correctness is assessed against source artifacts and behavior, not wording, headings or a phrase-matching score.

| Case | Correctness | Readiness decision | False blockers / scope | Evidence honesty | Recheck / preservation |
| --- | --- | --- | --- | --- | --- |
| UI regression | Both introduced issues found: 576/300px becomes 196/680px; missing module blocks required build while unit test passes | Correctly withheld local handoff readiness | 0; inherited footer excluded; findings-only respected | Build/unit/geometry claims supported; executor pixel-inspection claim has trace limitation below | Source unchanged; independent replay reproduces unit pass and build failure |
| Narrow label | Sole accepted wording change recognized; valid hash-bound prior click/storage/reload evidence reused | Correctly ready for narrow local handoff | 0; intentional static details excluded; no unrelated mandatory audit | Reuse attributed honestly; executor pixel-inspection claim has trace limitation below | Source unchanged; test/build pass; generated build bytes match source |
| Repair application | Shared cents-rounding cause repaired; cedar 1799 and meadow 897 in both output formats | Correctly ready for fictional local demo after recheck | 0; authoritative inputs/tests unchanged | Original failures retained and real browser checks supported; executor pixel-inspection claim has trace limitation below | Stored outputs checked before independent rebuild; both final HTML review controls exercised; test/build pass |
| Report review | 80/100 = 80%; absent March evidence and unsupported causality/expansion rationale identified | Correctly withheld content readiness | 0; findings-only respected | Renderer restriction respected; layout explicitly unverified | Source unchanged; recomputed arithmetic agrees |

Independent replay inspected already-generated repair outputs before running another build, preventing evaluator regeneration from concealing a missed delivery output. Each arm had both correct JSON totals and matching HTML amounts; browser activation changed Pending to Reviewed. Only money.mjs and the four dependent delivery outputs changed in the repair case. All assigned skill files remained unchanged. The original test failures and generated buggy outputs remained available. The evaluator also opened the actual frozen comparison screenshots and all six independently exercised repaired-preview screenshots and found the expected UI regression, the clean label layout, and readable repaired outputs.

## Evidence limit and adaptive clarification

The web-case executor reports claim visual inspection. The exported JSONL contains command, message and file-change items, but no positive image-view-specific metadata. Screenshots exist and actual browser/DOM checks are recorded; those alone do not independently prove that the executor viewed pixels. Because the CLI export may omit native tool detail, this is an unresolved trace limitation, not proof of fabricated tool use. The final controls show no demonstrated improvement in image-view traceability, and the report does not claim that the added guidance fixed this behavior. Independent evaluator pixel inspection supports artifact acceptance but cannot retroactively establish the executor's action.

The deliberate unavailable-renderer report case is different: every arm explicitly left layout unverified and obeyed the no-renderer constraint. No regression in that tool/evidence boundary was observed.

## Elapsed agent time

These are per-process elapsed agent seconds, not active human effort, which was not measured. Concurrency and a single observation per cell make timing unsuitable as a speed superiority claim.

| Case | Baseline | Initial candidate | Final candidate |
| --- | ---: | ---: | ---: |
| ui-review | 54.8s | 67.9s | 67.2s |
| label-review | 56.7s | 46.1s | 46.8s |
| repair-app | 65.2s | 51.4s | 69.3s |
| report-review | 49.6s | 47.6s | 49.4s |
| Sum of session elapsed time | 226.4s | 212.9s | 232.6s |

The public casepack contains authored fixtures, tasks, rubric, preparation code and this aggregate only. Raw prompts, events, final execution responses, logs, generated outputs and screenshots remain outside all Git checkouts. The portable preparation helper was smoke-tested from a copied public fixture tree and regenerated all five frozen screenshots with identical pixel-file hashes in the evaluation environment. Realpath/ancestor guards reject Git directories, worktree marker files and symlink destinations before browser launch or writes; refusal tests produced no raw files inside the disposable checkout.
