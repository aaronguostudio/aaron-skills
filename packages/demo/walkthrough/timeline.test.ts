import { describe, expect, test } from "bun:test";
import {
  FPS,
  MAX_SPEED,
  PRE_CLICK_MS,
  READ_MAX_MS,
  READ_MIN_MS,
  TITLE_MS,
  END_MS,
  buildTimeline,
  calibrate,
  chapters,
  cursorAt,
  framesShowing,
  highlightsAt,
  sourceMsToFrame,
  stillFrames,
  readingMs,
  speedFor,
  validateCapture,
  type Capture,
  type Step,
} from "../remotion/src/projects/walkthrough-video/timeline";

const capture: Capture = {
  version: 1,
  walk: "sample",
  env: "local",
  title: "Sample walkthrough",
  startedAt: "2026-10-05T00:00:00.000Z",
  viewport: { w: 1440, h: 900 },
  status: "passed",
};

const steps: Step[] = [
  { id: "open", caption: "Open the form", kind: "action", startMs: 1000, endMs: 3000, clicks: [{ tMs: 2500, x: 100, y: 200 }], shot: "shots/01-open.png" },
  { id: "save", caption: "Wait for it to save", kind: "wait", startMs: 3000, endMs: 19000, clicks: [], shot: "shots/02-save.png" },
  { id: "done", caption: "Saved", kind: "action", startMs: 19000, endMs: 19000, clicks: [], shot: "shots/03-done.png" },
];

describe("validateCapture", () => {
  test("accepts a passed capture", () => {
    expect(validateCapture(capture, steps)).toEqual([]);
  });

  test("refuses a failed walk and names the step", () => {
    const problems = validateCapture({ ...capture, status: "failed", failedStep: "save" }, steps);
    expect(problems.join(" ")).toContain('status is "failed" at step "save"');
  });

  test("refuses overlapping steps, stray clicks, odd viewports and escaping shot paths", () => {
    const bad: Step[] = [
      { ...steps[0], clicks: [{ tMs: 5000, x: 100, y: 200 }] },
      { ...steps[1], startMs: 2000, shot: "../outside.png" },
    ];
    const problems = validateCapture({ ...capture, viewport: { w: 1441, h: 900 } }, bad).join("\n");
    expect(problems).toContain("outside the step");
    expect(problems).toContain("starts before the previous step ends");
    expect(problems).toContain("must be positive and even");
    expect(problems).toContain("inside the capture folder");
  });
});

const raw = { minStepMs: () => 0 };

describe("buildTimeline", () => {
  const timeline = buildTimeline(steps, raw);

  test("fast-forwards waits and long gaps, plays actions at normal speed", () => {
    expect(speedFor(16000, true)).toBe(8);
    expect(speedFor(600000, true)).toBe(MAX_SPEED);
    expect(speedFor(16000, false)).toBe(1);
    const bySource = timeline.segments.map((s) => [s.srcStartMs, s.srcEndMs, s.speed, s.step]);
    expect(bySource).toEqual([
      // the lead-in before the first step (sign-in, page loads) is left out
      [1000, 3000, 1, 0],
      [3000, 19000, 8, 1],
      [19000, 19000, 1, 2], // the result step has no recording, so its shot is held
    ]);
    expect(timeline.segments[2].still).toBe("shots/03-done.png");
  });

  test("segments are contiguous and the duration adds up", () => {
    let frame = timeline.titleFrames;
    for (const s of timeline.segments) {
      expect(s.fromFrame).toBe(frame);
      frame += s.frames;
    }
    expect(frame).toBe(timeline.titleFrames + timeline.videoFrames);
    expect(timeline.durationInFrames).toBe(frame + timeline.endFrames);
    // 2 s action + 16 s / 8 + 2 s held result = 6 s of video.
    expect(timeline.videoFrames).toBe(6 * FPS);
  });

  test("calibration shifts every recorded time", () => {
    const shifted = calibrate(steps, 120);
    expect(shifted[0].startMs).toBe(1120);
    expect(shifted[0].clicks[0].tMs).toBe(2620);
    expect(calibrate(steps, 0)).toBe(steps);
  });
});

describe("mapping and chapters", () => {
  const timeline = buildTimeline(steps, raw);

  test("a recorded moment maps to the output frame, through fast-forward", () => {
    expect(sourceMsToFrame(timeline, 2500)).toBe(timeline.titleFrames + Math.round(1.5 * FPS));
    // Halfway through the 8x wait: 2 s of normal-speed video, then 8 s / 8 = 1 s.
    expect(sourceMsToFrame(timeline, 11000)).toBe(timeline.titleFrames + 3 * FPS);
  });

  test("chapters use output time, after the title card", () => {
    expect(chapters(timeline, steps)).toBe("0:02  Open the form\n0:04  Wait for it to save\n0:06  Saved\n");
  });

  test("the cursor glides to the click and ripples there", () => {
    const clickFrame = sourceMsToFrame(timeline, 2500);
    const before = cursorAt(timeline, steps, capture.viewport, timeline.titleFrames);
    expect(before).toMatchObject({ x: 720, y: 450, visible: true, ripple: null });
    const at = cursorAt(timeline, steps, capture.viewport, clickFrame);
    expect(at).toMatchObject({ x: 100, y: 200, ripple: 0 });
    expect(cursorAt(timeline, steps, capture.viewport, 0).visible).toBe(false);
  });
});

describe("reading time", () => {
  test("a caption stays up long enough to read, within bounds", () => {
    expect(readingMs("Open the form")).toBe(READ_MIN_MS);
    expect(readingMs("Make the sweep a transfer to the sweep account")).toBe(800 + 55 * 46);
    expect(readingMs(Array(40).fill("word").join(" "))).toBe(READ_MAX_MS);
  });

  test("a short action holds just before its first click, with the pointer on the target", () => {
    const quick: Step[] = [
      { id: "open", caption: "Open the form", kind: "action", startMs: 1000, endMs: 1600, clicks: [{ tMs: 1400, x: 1, y: 1 }], shot: null },
    ];
    const timeline = buildTimeline(quick);
    const [lead, hold, play] = timeline.segments;
    const holdAt = 1400 - PRE_CLICK_MS;
    expect(lead).toMatchObject({ srcStartMs: 1000, srcEndMs: holdAt, speed: 1, step: 0 });
    expect(hold).toMatchObject({ srcStartMs: holdAt, srcEndMs: holdAt, freeze: true, step: 0 });
    expect(play).toMatchObject({ srcStartMs: holdAt, srcEndMs: 1600, speed: 1, step: 0 });
    expect(lead.frames + hold.frames + play.frames).toBe(Math.round((READ_MIN_MS * FPS) / 1000));
    // The click lands after the hold, so the reader sees the caption and the target first.
    expect(sourceMsToFrame(timeline, 1400)).toBe(play.fromFrame + Math.round((PRE_CLICK_MS * FPS) / 1000));
  });

  test("a short action without clicks holds its last frame, the finished screen", () => {
    const look: Step[] = [
      { id: "look", caption: "Seven pending, as on the dashboard", kind: "action", startMs: 1000, endMs: 1600, clicks: [], shot: null },
    ];
    const [play, hold] = buildTimeline(look).segments;
    expect(play).toMatchObject({ srcStartMs: 1000, speed: 1, step: 0 });
    expect(hold).toMatchObject({ freeze: true, step: 0 });
    expect(hold.srcStartMs).toBeGreaterThan(1550);
    expect(hold.srcStartMs).toBeLessThan(1600);
  });

  test("a step without clicks holds where its last focus is still up, even if the focus ends a little early", () => {
    const look: Step[] = [
      { id: "look", caption: "Seven pending, as on the dashboard", kind: "action", startMs: 1000, endMs: 1600, clicks: [], shot: null, focus: [{ box: { x: 10, y: 10, w: 50, h: 20 }, fromMs: 1100, toMs: 1520 }] },
    ];
    const timeline = buildTimeline(look);
    const hold = timeline.segments.find((s) => s.freeze)!;
    expect(hold.srcStartMs).toBeLessThanOrEqual(1520);
    expect(highlightsAt(timeline, look, { w: 1440, h: 900 }, hold.fromFrame + 5).map((h) => h.kind)).toEqual(["focus"]);
  });

  test("a short wait holds what it waited for, not the frame it started on", () => {
    const wait: Step[] = [{ id: "w", caption: "Wait while it saves", kind: "wait", startMs: 1000, endMs: 1600, clicks: [], shot: null }];
    const [play, hold] = buildTimeline(wait).segments;
    expect(play).toMatchObject({ srcStartMs: 1000, step: 0 });
    expect(hold).toMatchObject({ freeze: true, step: 0 });
    expect(hold.srcStartMs).toBeGreaterThan(1550);
    expect(hold.srcStartMs).toBeLessThan(1600);
  });

  test("a wait is fast-forwarded no faster than its caption can be read", () => {
    const wait: Step[] = [
      { id: "w", caption: "Wait while the statement is read, filed and matched", kind: "wait", startMs: 0, endMs: 16000, clicks: [], shot: null },
    ];
    const [seg] = buildTimeline(wait).segments;
    expect(seg.speed).toBe(4); // 8x would show its caption for 2 s, under the 3.6 s it needs
    expect(16000 / seg.speed).toBeGreaterThanOrEqual(readingMs(wait[0].caption));
  });

  test("a step's own minimum wins, for example a voice clip's length", () => {
    const [lead, hold, play] = buildTimeline(steps.slice(0, 1), { minStepMs: () => 5000 }).segments;
    expect(hold.freeze).toBe(true);
    expect(lead.frames + hold.frames + play.frames).toBe(5 * FPS);
    const [still] = buildTimeline(steps.slice(2), { minStepMs: () => 4000 }).segments;
    expect(still).toMatchObject({ still: "shots/03-done.png", frames: 4 * FPS });
  });
});

describe("cards", () => {
  const raw = { minStepMs: () => 0 };

  test("an opening and a closing line lengthen the title and end cards, never shorten them", () => {
    const long = buildTimeline(steps, { ...raw, titleMs: 6000, endMs: 4000 });
    expect(long.titleFrames).toBe(6 * FPS);
    expect(long.endFrames).toBe(4 * FPS);
    expect(long.segments[0].fromFrame).toBe(6 * FPS);
    expect(chapters(long, steps).split("\n")[0]).toBe("0:06  Open the form");

    const short = buildTimeline(steps, { ...raw, titleMs: 1000, endMs: 1000 });
    expect(short.titleFrames).toBe((TITLE_MS / 1000) * FPS);
    expect(short.endFrames).toBe((END_MS / 1000) * FPS);
  });
});

describe("highlights: the clicked control and the evidence a step is about", () => {
  const viewport = { w: 1440, h: 900 };
  const button = { x: 1300, y: 480, w: 60, h: 24 };
  const card = { x: 900, y: 200, w: 400, h: 300 };
  const guided: Step[] = [
    // A step about a card: the walk outlined it (focus) and never clicked.
    { id: "look", caption: "Four items need attention", kind: "action", startMs: 1000, endMs: 2500, clicks: [], shot: null, focus: [{ box: card, fromMs: 1200, toMs: 2500 }] },
    // A step that opens a link: the hold goes just before the click.
    { id: "open", caption: "Open the missing records", kind: "action", startMs: 2500, endMs: 3400, clicks: [{ tMs: 3200, x: 1330, y: 492, box: button }], shot: null },
    { id: "load", caption: "Loading", kind: "wait", startMs: 3400, endMs: 9400, clicks: [], shot: null },
    // The result: a box given as [x, y, w, h], as some capture tools write it.
    { id: "result", caption: "The list matches the count", kind: "action", startMs: 9400, endMs: 10000, clicks: [], shot: null, focus: [{ box: [100, 120, 300, 40], fromMs: 9500, toMs: 10000 }] },
  ];
  const timeline = buildTimeline(guided, { minStepMs: () => 4000 });

  test("framesShowing covers a hold, since the held frame shows that moment", () => {
    const hold = timeline.segments.find((s) => s.freeze && s.step === 1)!;
    const range = framesShowing(timeline, 3200 - PRE_CLICK_MS, 3200)!;
    expect(range.first).toBe(hold.fromFrame);
    expect(range.last).toBeGreaterThan(hold.fromFrame + hold.frames - 1);
    expect(framesShowing(timeline, 50000, 60000)).toBeNull();
  });

  test("the clicked control is outlined through the pre-click hold, drawn on, then gone after the click", () => {
    const hold = timeline.segments.find((s) => s.freeze && s.step === 1)!;
    const clickFrame = sourceMsToFrame(timeline, 3200);
    const during = highlightsAt(timeline, guided, viewport, hold.fromFrame + hold.frames - 1).filter((h) => h.kind === "click");
    expect(during).toHaveLength(1);
    expect(during[0].draw).toBe(1);
    expect(during[0].opacity).toBe(1);
    // Padded around the control, so the outline never covers its label.
    expect(during[0].box.x).toBeLessThan(button.x);
    expect(during[0].box.x + during[0].box.w).toBeGreaterThan(button.x + button.w);
    expect(highlightsAt(timeline, guided, viewport, clickFrame + Math.round(FPS / 2)).filter((h) => h.kind === "click")).toEqual([]);
  });

  test("an outline draws itself on when it appears", () => {
    const range = framesShowing(timeline, 1200, 2500)!;
    const [first] = highlightsAt(timeline, guided, viewport, range.first);
    expect(first.kind).toBe("focus");
    expect(first.draw).toBeGreaterThan(0);
    expect(first.draw).toBeLessThan(0.2);
  });

  test("a focus stays through its step's hold, and a [x, y, w, h] box is read too", () => {
    const hold = timeline.segments.find((s) => s.freeze && s.step === 3)!;
    const [focus] = highlightsAt(timeline, guided, viewport, hold.fromFrame + 2);
    expect(focus.kind).toBe("focus");
    expect(focus.box.x).toBeLessThan(100);
    expect(focus.box.w).toBeGreaterThan(300);
    expect(highlightsAt(timeline, guided, viewport, timeline.titleFrames + timeline.videoFrames + 1)).toEqual([]);
  });

  test("the pointer is on the target for the whole pre-click hold", () => {
    const hold = timeline.segments.find((s) => s.freeze && s.step === 1)!;
    const at = cursorAt(timeline, guided, viewport, hold.fromFrame);
    expect(at).toMatchObject({ x: 1330, y: 492, visible: true });
  });

  test("the click outline appears as the pointer lands on the control, not before", () => {
    const clickFrame = sourceMsToFrame(timeline, 3200);
    let landed = -1;
    for (let f = timeline.titleFrames; f < clickFrame; f++) {
      const c = cursorAt(timeline, guided, viewport, f);
      if (c.x === 1330 && c.y === 492) {
        landed = f;
        break;
      }
    }
    expect(landed).toBeGreaterThan(timeline.titleFrames);
    expect(highlightsAt(timeline, guided, viewport, landed - 1).some((h) => h.kind === "click")).toBe(false);
    expect(highlightsAt(timeline, guided, viewport, landed).some((h) => h.kind === "click")).toBe(true);
    // It lands about a second of recording before the click, so the outline is seen even without a hold.
    expect(framesShowing(timeline, 3200 - 1100, 3200)!.first).toBeLessThanOrEqual(landed);
  });

  test("on a step without clicks the pointer parks beside the evidence, not on it", () => {
    const range = framesShowing(timeline, 1200, 2500)!;
    const parked = cursorAt(timeline, guided, viewport, range.first + 10);
    expect(parked.visible).toBe(true);
    expect(parked.x).toBeGreaterThan(card.x + card.w);
    expect(parked.y).toBeGreaterThan(card.y);
    expect(parked.y).toBeLessThan(card.y + card.h);
    // Evidence at the right edge: the pointer parks on its left instead.
    const edge: Step[] = [{ ...guided[0], focus: [{ box: { x: 1100, y: 200, w: 330, h: 100 }, fromMs: 1200, toMs: 2500 }] }];
    const t = buildTimeline(edge, { minStepMs: () => 4000 });
    const left = cursorAt(t, edge, viewport, framesShowing(t, 1200, 2500)!.first + 10);
    expect(left.x).toBeLessThan(1100);
  });

  test("calibration shifts focus times, and a focus outside its step is refused", () => {
    expect(calibrate(guided, 100)[0].focus![0]).toMatchObject({ fromMs: 1300, toMs: 2600 });
    const stray: Step[] = [{ ...guided[0], focus: [{ box: card, fromMs: 900, toMs: 2500 }] }];
    expect(validateCapture(capture, stray).join(" ")).toContain("focus");
    const shapeless: Step[] = [{ ...guided[0], focus: [{ box: [1, 2] as unknown as [number, number, number, number], fromMs: 1200, toMs: 2500 }] }];
    expect(validateCapture(capture, shapeless).join(" ")).toContain("focus");
    expect(validateCapture(capture, guided)).toEqual([]);
  });
});

describe("stills for checking a render", () => {
  test("one frame per step: the middle of its hold, else near its end", () => {
    const quick: Step[] = [
      { id: "open", caption: "Open the form", kind: "action", startMs: 1000, endMs: 1600, clicks: [{ tMs: 1400, x: 1, y: 1 }], shot: null },
      { id: "long", caption: "Wait", kind: "wait", startMs: 1600, endMs: 9600, clicks: [], shot: null },
    ];
    const timeline = buildTimeline(quick);
    const hold = timeline.segments.find((s) => s.freeze && s.step === 0)!;
    const [open, long] = stillFrames(timeline, quick);
    expect(open).toEqual({ id: "open", index: 0, frame: hold.fromFrame + Math.floor(hold.frames / 2) });
    const last = timeline.segments.filter((s) => s.step === 1).at(-1)!;
    expect(long.frame).toBe(last.fromFrame + last.frames - 3);
  });
});
