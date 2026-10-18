# Narrative styles and script drafting

Users can provide a brief, rough notes, an existing script, or ask the agent to
propose a script from a passed capture. A finished script is not a prerequisite.
This guide is used by the host agent; the renderer does not call a language model
or generate a script by itself.

Choose the communication goal first. Tone, length, visual template and voice are
separate choices: a conversational release update can use any visual template,
and a training video does not require a particular voice provider.

## Five starting modes

These are authoring presets, not new CLI flags or JSON fields. Adapt them to the
user's brief; do not force every video into the same structure or duration.

| Mode | Viewer outcome | Useful structure | Default delivery |
| --- | --- | --- | --- |
| `quick-demo` | Understand one capability and its visible result | Outcome → shortest evidenced path → result | Direct, concise; omit navigation commentary that adds no meaning |
| `release-update` | Understand a verified change, its impact and rollout scope | What changed → demonstration → availability/limits → next action | Precise and factual; distinguish demonstrated behavior from release status |
| `stakeholder-walkthrough` | Understand the workflow's value and give informed feedback | Viewer problem → guided scenario → why key decisions matter → feedback or decision needed | Conversational; explain reasoning and tradeoffs without narrating every click |
| `task-tutorial` | Complete one specific task independently | Goal/prerequisites → ordered actions and checkpoints → successful result | Instructional; name the actual controls, expected results and evidenced recovery steps |
| `training-lesson` | Learn a workflow well enough to apply it in another case | Learning objective → relevant concept → worked example → practice prompt → recap/check | Patient coaching; explain why, define unfamiliar terms and separate demonstration from practice |

A tutorial answers “How do I do this task?” A lesson also builds understanding and
offers a way to check learning. A stakeholder walkthrough seeks understanding or a
decision; it need not teach every operational detail. A release update needs a
verified change and release context, not just a confident tone.

If a release brief lacks verified change or rollout information, label the draft
as a release-style review of demonstrated behavior. Do not invent a before/after
comparison or imply that the demonstration proves a new production release.

When the request clearly names a purpose, choose it and state the assumption.
For an ambiguous request, use `quick-demo` for a short capability demonstration or
`stakeholder-walkthrough` for an explanatory tour. Ask only when an unresolved
audience, intended action or claim would materially change the script.

## A small brief is enough

Infer what is already supplied. Useful inputs are:

- Audience and what they should know or do afterward.
- Mode, requested tone, language and approximate length, if specified.
- Passed capture/run, or the intended workflow if recording has not happened yet.
- Points that must be covered, relevant product facts, and things to avoid.
- For a release update: an approved change summary and verified environment,
  availability and limitations. A repository change alone does not prove deployment.

For example, a user can say:

> Use the passed capture to explain the invoice review to a new teammate. Make it
> a task tutorial in English, with a friendly tone. Show how to confirm the count
> and total before continuing. Keep it concise and draft the script for me.

Do not require a form, all optional fields, a chosen provider, or polished prose to
start drafting. If there is no capture yet, draft a provisional outline and a
capture plan; do not invent step IDs or present unrecorded behavior as verified.

## From brief to a renderable script

1. Read the relevant mode above. Inspect the passed run with `aaron-demo inspect
   <run>` and review its saved steps, screenshots and assertions. The existing
   step order is the playback order; script object ordering cannot rearrange it.
2. Match each intended claim to the screen or supplied source that supports it.
   Keep product explanation, observed UI behavior and release/deployment status
   distinct. If an important result is missing, flag the gap; narration cannot
   repair missing evidence. Do not replay writes merely to change the story.
3. Draft a viewer-readable script first: opening, a line for each relevant step,
   and a useful close. Keep navigation steps brief or silent. Put contextual
   reasoning beside the result it explains, rather than describing a screen the
   video has not reached. Keep captions short; they need not transcribe the voice.
   Keep opening/closing card narration to a short sentence; put extended explanation
   on the relevant evidenced steps rather than holding on a logo for a paragraph.
4. Review the draft against the brief and evidence. Show a short script preview
   when the user is exploring a new style or when material claims remain open.
   Drafting does not require a provider call. If the user already authorized
   generation and the needed choices are clear, continue without another approval
   round; unresolved claims or missing spending/voice authorization still matter.
5. Save `narration.json` outside Git using the existing schema below. Keep any
   audience brief, claim/source map, assumptions or practice notes alongside it,
   not as unsupported fields in the renderer's JSON. Preserve each prior version.
6. Validate with `render --script <external-script.json> --dry-run`, then render
   using the selected audio route. Inspect the actual timing, held frames and wait
   endings and review/listen to audio where available. Report any listening limit;
   duration and peak measurements alone do not establish voice quality.

The renderer can lengthen holds for spoken lines. Avoid stretching one static
screen into a lecture to reach a target length. Shorten the explanation or propose
additional evidenced scenes. The current renderer does not create quizzes,
interactive exercises, new teaching slides or extra app actions from a script.
Practice prompts can be spoken instructions, explicitly separate from actions
performed in the recording. Do not claim learning effectiveness from rendering.

## Existing script format

This fictional example assumes a passed capture contains a showing step named
`review-total`, with both fields visible and checked. Replace it with actual saved
IDs and evidence; it is not a script for an arbitrary capture.

```json
{
  "intro": "Let's review the count and total before continuing.",
  "steps": {
    "review-total": "Check both fields: two invoices, totaling two thousand dollars. Confirm these match the records you intended to select."
  },
  "outro": "In a separate test case, repeat the check with your expected count and total."
}
```

`steps` maps existing capture IDs to spoken text. `intro` and `outro` are optional.
Unknown step IDs fail validation. With `--script`, omitted or blank step lines
remain silent; there is no automatic caption fallback for those steps. Captions
and UI steps remain visible. Without a script, `--narrate` uses saved narration or
the caption for each step. Intro/outro lines need their corresponding cards enabled.

```sh
aaron-demo render <passed-run> --script <external-script.json> --dry-run
aaron-demo render <passed-run> --script <external-script.json> --template professional --stills --out <external-output>/walkthrough.mp4
```

`--script` implies generated narration and uses the configured ElevenLabs route.
It is not a provider-neutral script-only command. To record a human voice or use
another TTS tool, draft the same text without invoking generation, produce the
clips independently, then supply the transcript and clips through `--audio`.
See [narration](narration.md). Visual packaging is configured independently in
[video presentation](video-presentation.md). Never put the mode, audience or tone
into a voice profile, or silently choose another person's voice/account.

## Same evidence, different explanation

For the fictional `review-total` showing step above:

| Mode | Example line |
| --- | --- |
| Release update | “The recorded test result shows two invoices totaling two thousand dollars.” This describes evidence only; a claim about what changed or who has access requires separate verified release information. |
| Stakeholder walkthrough | “Let's look at the count and total together: two invoices, two thousand dollars. This is the checkpoint I want us to review before moving on.” |
| Task tutorial | “Check that the count is two and the total is two thousand dollars before you continue.” |
| Training lesson | “Check both fields. The count tells you how many invoices are selected; the total tells you their combined amount. In your test case, compare both with your expected values.” Use the field explanation only when supplied product facts or the fixture confirm those meanings. |
| Quick demo | “Two invoices. Two thousand dollars. Both values are visible in the summary.” |

Changing style must not change numbers, invent a successful save, imply production
availability, or turn a demonstration into a testimonial. Avoid simulated dialogue,
filler, invented stakeholder quotes and claims such as “fully verified” without
the corresponding evidence. Conversational means natural explanation, not lower
factual standards; authoritative means precise scope, not stronger claims.

## Review the script before reviewing the voice

- **Purpose:** Does the viewer know the goal and the useful next action?
- **Evidence:** Can each UI/result claim be matched to its visible step? Are
  limitations, environment and release status accurate?
- **Fit:** Does the chosen mode serve the audience? For teaching, are prerequisites,
  checkpoints and practice distinguished from performed actions?
- **Pacing:** Does each line fit the moment without long static holds or referring
  to the wrong screen? Are important results given time to read?
- **Delivery:** Are terms, names, numbers and pronunciation clear in actual audio?
  Does the output retain every visual evidence check required by the capture?

This is an authoring/review checklist, not a new benchmark rubric or score. Keep the
existing benchmark task, rubric, profiles and frozen results unchanged. Real briefs,
scripts, voice clips, configurations and generated media stay outside public Git;
public examples must be wholly fictional or independently approved public material.

## Compare modes with the same evidence

For a style review, hold the recording, steps, captions, visual template, language,
voice and delivery settings constant. Draft a separate script for each requested
mode and render into separate external directories. Length may differ with the
explanation; avoid adding filler just to equalize durations. Compare the audience
outcome, reasoning, instructions and checkpoints, as well as natural delivery.

Check actual audio loudness as well as peaks, so one sample is not preferred merely
because it is louder. Preserve raw takes and record any delivery processing; the
renderer does not automatically normalize loudness. Keep any external processing
separate from source capture evidence and verify the final timing and decode.
Choose voice and pace from the user's configuration; a review's personal settings
must not become defaults for everyone.

A style comparison is separate from a frozen benchmark. Record the review and any
remaining listening limitations outside Git; do not turn approval of a sample into
a benchmark score or general claim that every mode has been validated.
