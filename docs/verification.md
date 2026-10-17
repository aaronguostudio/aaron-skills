# v0.1.0 local launch verification

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
