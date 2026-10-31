# Context callouts in Film

Use a context callout sparingly when narration needs to explain a meaningful fact that is not visible in the application. The agent prepares the content and timing from independently checked evidence and reviews it with the video. Do not turn every spoken sentence or screen into an overlay. Distinguish local tests, synthetic data, estimates and actual customer results. The callout is editorial context, not a claim that its content is shown by the application.

For a passed Capture recording, save a JSON file outside the repository and render with `aaron-demo render <run> --callouts <external.json>` alongside the selected presentation and existing narration options. Times are **milliseconds relative to the beginning of the named rendered step**, not the original recording or whole video. The agent should align each metric with the saved narration and review the result at normal playback speed. One to three metrics are supported per callout. Set a box in capture-screen pixels, using open space that does not obscure important application content. The box must fit within the captured viewport. Place it away from the edge to leave room for its shadow. Never cover masks, important controls, subtitles or evidence; inspect the actual rendered frames and audio. Original recordings and audio remain unchanged.

```json
{
  "version": 1,
  "callouts": [{
    "step": "review",
    "startMs": 1000,
    "endMs": 12000,
    "box": {"x": 180, "y": 430, "w": 750, "h": 180},
    "title": "Test run",
    "description": "Local synthetic data",
    "source": "Local test report, section 3",
    "metrics": [
      {"value": "120", "label": "sample records", "atMs": 5000},
      {"value": "24", "label": "sample files", "atMs": 7000}
    ]
  }]
}
```

`source` is a private evidence reference for the agent, not a visible attribution or independently verified claim. Keep this file with the run outside Git. The renderer checks structure, bounds, step identity and duration; it cannot determine whether a claim is true, whether a placement obscures the app, or whether timing matches a narrator. It does not transcribe speech or find evidence automatically. Confirm these in review. The compact heading expands before the first metric and facts appear in order; the callout fades away at the specified end. Existing clips can be reused without another provider call.
