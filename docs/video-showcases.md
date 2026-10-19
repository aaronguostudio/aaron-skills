# Short video showcases

The [website examples](https://skills.aaronguo.com/#examples) pair a public blog
with a fictional signed-in application. Each story uses one passed Capture run;
Film changes how that recording is explained and presented.

These are curated demonstrations, not benchmark results or evidence of improved
scores. The frozen blog benchmark is unchanged.

## Two stories

**One useful thought. Worth coming back to.** Open the public Builder Notes
archive, find a note about slow iteration, inspect the idea and its illustration,
and return to the archive. This read-only story needs no account.

**Two invoices. One checked decision.** In the fictional
[review workspace](../examples/showcase-review/README.md), add a missing category
and review note, select two invoices, check the $2,000 total, approve the simulated
batch, reload, and verify the saved count, total and status. Its local cookie gate
uses a seeded demo reviewer. It does not demonstrate a production identity provider
or move money. Real application sign-in remains a human step.

## Eight narrated examples

The fictional product recording is presented as Official Product Demo, Quick Demo,
Release Update, Stakeholder Walkthrough, Task Tutorial and Training Lesson. The
blog has a Task Tutorial and Stakeholder Walkthrough. All eight use the same
Professional visual template to make their different explanations easier to compare.
Official Product Demo is an editorial framing, separate from the five documented
narrative purposes. The welcome film is a separately authored introduction.

The website features finished narrated cuts. Silent rendering remains available
in the tool for users who need it. An expandable, fictional reference-library
script illustrates how to draft a short explanation; it is not a transcript of
these recordings. Real run scripts stay outside Git.

These pairings are editorial choices. Every explanation style can use any visual
template. Narration, intro sound, logo and opening/closing cards are separate
choices. See [narrative styles](narrative-styles.md),
[presentation configuration](video-presentation.md) and [voice options](narration.md).

## Reproduce the approach

Install the Demo bundle, prepare a working application adapter, and agree the
scenario's hosts and write policy before recording. For the fictional fixture,
follow its README to start the local server and seed the demo session. Keep the
session directory and all output outside every Git checkout.

```sh
aaron-demo capture --project <project> --env <environment> --walk <walk> \
  --out <external-workspace>/capture
aaron-demo render <external-workspace>/capture --template minimal \
  --cover --stills --out <external-workspace>/delivery/minimal/walkthrough.mp4
```

The synthetic approval walk additionally requires `--write-go-ahead`. A production
environment requires the planned production confirmation. Do not add network hosts
or read-only write exceptions implicitly when a capture is refused.

For a tutorial, a useful brief is: “Help a first-time reviewer complete this one
task. Use short instructions. Explain the checkpoint before the irreversible
action. Tie every claim to recorded evidence.” For a stakeholder walkthrough:
“Explain what problem this flow solves, why the checkpoint matters, and what the
verified result tells us. Sound like a colleague, not a product announcement.”

Film can draft the script. Review it against the actual step IDs, then keep it in
the external workspace. Choose a permitted voice and provider explicitly before
synthesis. `--script` requests ElevenLabs narration; `--audio` imports measured
local clips; `--voice-provider none` needs no voice account. A dry run does not
call the provider. Qwen is a reserved interface, not a validated built-in backend.

```sh
aaron-demo render <passed-run> --template professional \
  --script <external-workspace>/tutorial.json --dry-run
aaron-demo render <passed-run> --template professional \
  --script <external-workspace>/tutorial.json --cover --stills \
  --out <external-workspace>/delivery/tutorial/walkthrough.mp4
```

Inspect every held frame, each wait ending, the cover, opening, closing, and actual
audio. Correct captions/highlights through `inspect` and `revise` when the recording
and checks are already right. Re-record when the UI evidence needs to change.
Confirm final duration and playback; a passed application check alone does not
establish presentation quality.

## Public delivery boundary

Authored fictional fixture source and generic recipes belong in this repository.
Raw captures, screenshots, scripts, session cookies, local narration/configuration,
render records and review logs stay outside Git. Only deliberately reviewed final
MP4, compressed WebP poster and caption exports are uploaded to the website's
dedicated public media store. The website keeps delivery URLs and safe metadata;
it loads videos on demand without autoplay. A public export is a publication
decision, not an automatic consequence of recording a public page.

This fixture is not registered as a benchmark case. Adding repeatable scored
evaluation requires its own case, frozen task and rubric under the existing
[benchmark policy](../benchmarks/PRIVACY.md).

For maintainers in a full Git checkout, before publishing a website change, run
`npm run test:showcases`, `npm run build`
and `npm run test:sites` from `website/`. Then run `npm run verify:showcase-media`
for a read-only check of every CDN export's hash, delivery size, content type,
cross-origin access, video seeking, fast-start layout, WebP format and caption
timing. This online probe is separate from the deterministic build. A targeted
`--case <id> --variant <id>` probe can check a completed cut while authoring;
it does not establish readiness of the full media set. Review actual browser
playback separately, and verify the production Git/main SHA after deployment.
