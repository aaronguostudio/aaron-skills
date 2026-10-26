# Walkthrough capture folder (contract version 1)

`WalkthroughVideo` turns a capture folder into a short walkthrough video:

- a title card, or a brand's opening card with `--brand`;
- the screen recording, with a caption band for each step;
- a drawn pointer with a soft amber halo: it glides onto each control about a second before the click, rests there, and ripples where the click lands;
- an amber outline that draws itself around the control being clicked (from `clicks[].box`), and around each region a step names in `focus`;
- waits fast-forwarded behind an "N× faster" badge;
- an end card, or the brand's closing card.

It is silent by default. With `--narrate`, each step also gets a voice clip (see Narration).

Any tool that drives an app can produce the folder. This side never knows which app it was.

## Render

```bash
npx -y bun packages/demo/walkthrough/render-walkthrough.ts <run> [--out <file.mp4>] [--narrate] [--script <script.json>] [--voice-profile <id>] [--speed <0.7-1.2>] [--brand <id>] [--stills] [--dry-run]
```

- It validates the folder first and refuses a capture whose `status` is not `passed`. A failed walk gets no video.
- It writes `walkthrough.mp4` (H.264, yuv420p; AAC audio when narrated or when a brand brings a sting) and `chapters.txt` (`m:ss  Caption` per step, in output time) into the run folder.
- It refuses a run folder or an output inside this repo. Captures are someone else's material; they never enter the content pipelines here.
- `--dry-run` validates and writes `chapters.txt` without rendering.
- `--stills` also writes `stills/NN-<step-id>.jpg` beside the video: one frame per step, the middle of its hold (the frame the viewer looks at longest), else just before it ends. Look at every one before delivering.
- To test without a real capture, build a synthetic one: `npx -y bun packages/demo/walkthrough/make-fixture.ts <empty folder outside the repo>`.

## Pacing

Every step stays on screen long enough to read its caption: `readingMs = 800 + 55 ms per character`, between 2 and 6 seconds (about 18 characters a second, the usual subtitle rate).

- A step that needs more time than it recorded holds one frame for the rest:
  - **an action with clicks** holds just before its first click, with the pointer on the control and the control outlined, so the caption is read (or the line spoken) while the screen shows what is about to happen; then the click plays;
  - **an action without clicks** holds its last frame, the finished screen, with its `focus` outlined (if its last focus ends earlier, it holds the last moment that focus is up);
  - **a wait** plays fast-forwarded and then holds its last frame, what it was waiting for. Holding its first frame instead leaves the caption to be read against the spinner, with the pointer and any outline already sitting on controls that have not rendered yet.
    - The recording can still withhold that frame. Playwright's screencast writes a frame only when the page paints and emits nothing while the page sits idle, so a wait whose page goes quiet while a server works keeps the spinner as its last recorded frame however long the step dwells (measured 2026-10-16: tails of 1.2 s, 2.2 s and 4 s all failed, as did forcing paints from inside the page). Write such a step's caption about *waiting*, and let the step after it — which scrolls to the result and outlines it, and so forces the paint — be where the result appears.
- A wait is fast-forwarded, but never so fast that it ends before its caption is read.
- A narration line and a 0.4 s pause must fit in its step plus the silent steps after it. The voice plays on while those steps are clicked through, and the time is shared by their reading times. In the concise style every step has its own line, so each step simply stays up for its clip.

## Narration

Choose narration language from the user's brief. Reuse a passed capture when only narration changes. Configure a user-owned voice using `AARON_DEMO_VOICE_PROFILES`; see [narration setup](narration.md).

Two styles, both in a user-configured ElevenLabs voice (the default profile unless `--voice-profile` names another):

- **Concise** (`--narrate`): each step's `narration`, or its caption when it has none. Short and official.
- **Conversational** (`--script <file>`, which implies `--narrate`): a script written for the run, so the video sounds like a person giving the demo. The captions on screen stay the short step titles.

```json
{
  "intro": "Hi, here's a quick tour of the new form.",
  "steps": {
    "open": "Let's start by opening the form. Notice it already knows who you are.",
    "save": "I'll save it now. This takes a few seconds, so I've sped it up."
  },
  "outro": "That's all it takes. Happy to walk through it live."
}
```

- `intro` plays over the title card and `outro` over the end card. The cards stay up as long as their line.
- `steps` maps step ids to lines. A step without a line stays silent, so one line can cover several quick clicks.
- **Keep a card's line to one short sentence.** A card stays up for as long as its line takes to say, so an opening line is a title, not a paragraph: three or four seconds, then the walkthrough starts. An eighteen-second line leaves the viewer staring at a logo, and six chapters of long opening and closing lines can add a minute and a half of cards to a ten-minute film. Anything worth saying at length belongs on a step, where there is something on screen to look at.
- **An official demo opens on the product, not on its caveats.** One short clause placing the recording ("everything you'll see runs in a demonstration centre") is enough; do not spend the opening on three of them, and do not repeat "fictional", "local" and "no family was notified" in every chapter's intro and outro. The limits belong in the Read-Me, in full, where someone deciding what to do with the film will read them. A film that hedges in every breath does not sound like a product.
- **The narration speaks for the product, not about who asked for what.** Never attribute a behaviour to a named colleague ("X wanted…", "X asked for…"): a film is often watched by that person, and a feature is rarely one person's idea anyway, so it reads oddly either way. Say what the thing does and why it is the right behaviour — "the rule we hold to is…", "writing help belongs inside the app teachers already use". The same goes for the Read-Me and anything else shipped beside the film; keep the names in the internal verification record.
- A line for a step id the capture does not have is refused, before any voice is made.
- The script is run material: keep it in the run folder (`narration.conversational.json`). One inside this repo is refused.

- Walkthroughs speak at 1.15× by default, a little faster than the profile's long-form pace. `--speed` sets another speed from 0.7 to 1.2 (ElevenLabs' own setting, so the voice is not pitch-shifted). The profile itself is unchanged.
- The clips are cached in `<run>/narration/`, keyed by voice, settings (speed included) and text. A re-render calls the API only for lines whose words or voice settings changed.
- Set `ELEVENLABS_API_KEY` in the process environment, or use the dedicated macOS Keychain service `aaron-demo-elevenlabs`. Keys are never bundled or printed.

- Delivered cards, caption bands and covers omit narration/process labels by default. Add `--narration-notice` only when the user explicitly requests a visible narration notice; provenance stays in the external render manifest.
- Narrate only when requested, using a voice the user has permission to use.

## Branding

`--brand <id>` names a profile in `packages/demo/config/brand-profiles.json` (or `AARON_DEMO_BRAND_PROFILES`) and gives the walkthrough an identity: its opening and closing cards, and its mark in the corner of the caption band on every frame.

- The opening card assembles the mark piece by piece, raises the line under it, plays the brand's sting once, and fades into the walkthrough. The closing card is the same lockup, already settled, held silent.
- **The sting and the opening line do not start together.** The sting plays alone and the voice comes in over its decay, `BRAND_STING_LEAD_MS` (1.4 s) later; the opening card is lengthened by the same amount, so nothing is cut short. Starting both at zero makes the voice and the music fight for the first two seconds.
- A profile is `name`, `slogan` (at most 72 characters, so it can be read at a glance), `primary` (the card's background, a dark colour — the name and line on it are white), `parts`, and optionally `viewBox` and `sound`.
- `parts` are the primitives copied out of the brand's own SVG (`rect`, `path`, `polygon`, `ellipse`, `circle`), each with its own attributes and an optional `fill`. Copy them rather than redrawing the mark, so the card carries the real asset; each part is animated separately as the mark settles.
- `sound` is relative to the profile file's directory. It is copied into `<run>/brand/` at render time, because the composition reads every asset through `staticFile()` and the capture folder is the render's public dir. Build or retune one with `scripts/walkthrough/make-brand-sound.py`.
  - A sting reads as a brand when its weight sits low: the figure in the named octave rather than above it, a sub and a fifth holding underneath, upper partials restrained, and the last note left ringing so it lands. High and bare is the failure mode — it sounds thin, bright and generic. The script's `--body`, `--brightness`, `--voicing` and `--stagger` are the knobs to turn by ear, and the honest way to choose is to render several and listen, not to reason about the numbers.
- Branded films also omit narration labels by default. A user-requested `--narration-notice` or explicit `"aiNotice": true` brand setting enables the opening notice; omitted/false settings keep it off. Do not add review/draft or generation labels without an explicit user request.
- A profile that is not there, or names a sound that is not there, is refused before any voice is made or any frame is rendered.

## Folder

```
<run>/
  capture.json
  video.webm            # screen recording, exactly viewport-sized
  steps.json
  shots/NN-<step-id>.png
  walkthrough.mp4       # written by the renderer
  chapters.txt          # written by the renderer
```

## capture.json

```json
{
  "version": 1,
  "walk": "sample-walk",
  "env": "local",
  "title": "Sample walkthrough",
  "subtitle": "Open a form, save it, wait for it to finish",
  "appRevision": "abc1234",
  "startedAt": "2026-10-05T16:00:00.000Z",
  "viewport": { "w": 1440, "h": 900 },
  "status": "passed",
  "failedStep": "save",
  "failure": "Plain-English reason, only when status is failed",
  "sync": { "tMs": 712 },
  "calibrationMs": 0
}
```

- `viewport` sizes must be even, as H.264 requires.
- `sync` is optional and recommended. The screencast starts a few hundred ms after the capture's clock, so logged times run ahead of the video.
  - To mark the offset, a capture shows an all-black page, turns it white, and logs that moment as `sync.tMs`.
  - The renderer finds that frame with ffprobe and subtracts the difference from every time.
- `calibrationMs` is optional and sets the offset directly. Precedence: `--calibration-ms`, then `calibrationMs`, then `sync`.

## steps.json

```json
[
  {
    "id": "open",
    "caption": "Open the form",
    "kind": "action",
    "startMs": 1000,
    "endMs": 3000,
    "clicks": [{ "tMs": 2500, "x": 230, "y": 188, "box": { "x": 120, "y": 160, "w": 220, "h": 56 } }],
    "shot": "shots/01-open.png"
  }
]
```

- Steps are ordered and do not overlap. Times are milliseconds on the capture's clock, which starts with the recording; see `sync`.
- The video starts at the first step. Anything recorded before it (sign-in, the sync flash, page loads) is left out.
- `kind` takes one of two values:
  - `action` plays at normal speed.
  - `wait` (server work) is fast-forwarded to about two seconds on screen, at most 16×, and never shorter than its caption's reading time (see Pacing).
- Gaps between steps longer than 1.5 s are fast-forwarded too.
- Each click is logged just before it happens. Its fields are viewport CSS px:
  - `x`, `y` are the centre of the element;
  - `box` is the element's bounding box.
- `shot` is taken before the step's first click, so the element to click is visible.
- The last step is a result step with no clicks. When it has no duration, its shot is held for two seconds.
- `shot` may be `null`. A shot path must stay inside the folder.
- Captions are the reader's words: short and plain.
- `narration` is optional: what the voice says for the step when it should differ from the caption.
- `focus` is optional: the regions the step is about (a card, a row, a total, a filter), each outlined while the recording shows it.

  ```json
  "focus": [{ "box": { "x": 900, "y": 200, "w": 400, "h": 300 }, "fromMs": 1200, "toMs": 2500 }]
  ```

  - `box` is the region's bounding box in viewport CSS px, measured once scrolling has stopped. `[x, y, w, h]` is read too.
  - `fromMs` and `toMs` are on the capture clock and inside the step. Ending a focus at the step's end keeps it up through the hold.
  - On a step without clicks, the pointer parks beside the step's first focus (to its right, else its left), clear of the outline.
  - **Measure a region only once it has stopped moving, and start `fromMs` there.** A box read while a dialog or panel is still animating is the region's final place, so the outline is drawn on a part of the screen that is still empty and the content arrives underneath it. Waiting for the element to exist is not enough: it exists from the first frame of the transition. Wait for its animations to finish and its box to stop changing:

    ```js
    await locator.waitFor({ state: 'visible' })
    await locator.evaluate(async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})))
      let last = null
      for (let still = 0; still < 3; ) {
        const now = JSON.stringify(el.getBoundingClientRect())
        still = now === last ? still + 1 : 0
        last = now
        await new Promise(requestAnimationFrame)
      }
    })
    const box = await locator.boundingBox()
    ```

    A fixed sleep is the thing this replaces: it is either too short for a slow transition or wasted time on every other step. Clicks logged through a recorder that trial-clicks first already get this, because the trial waits for the element to be stable before it reports the box.

## Optional pixel masks

`capture.json` may carry an optional `masks` array of `{box, fromMs, toMs}`
in viewport pixels and original capture-clock milliseconds. Masks cover rendered
pixels, including gap/hold frames; empty or omitted keeps the ordinary demo.
See [data masking](data-masking.md) for timing, screenshots and delivery limits.

## Optional checked-focus metadata

New `rec.focus` / `rec.show` steps may include `targets`, keyed by a stable target name with
`boxes: [{x,y,w,h}]`, `fromMs`, `toMs`. `rec.show` also stores `evidence`, keyed by the same
names with `{kind, expected}` exact-check declarations. This is additive contract-1 metadata;
older captures remain supported. Named geometry is immutable source evidence during a
presentation revision. The installed CLI checks that all declared evidence targets remain
highlighted before rendering. See [project adapters](project-adapters.md) and
[presentation revisions](presentation-revisions.md). These checks do not prove undeclared
claims or make an arbitrary adapter safe; business/visual review is still needed.
