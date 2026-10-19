import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { RenderRefusal, detectSyncOffset, insideAny, main, parseArgs, prepare, readScript, repoRoots } from "./render-walkthrough";
import { SKEW_MS, fixtureSteps, makeFixture } from "./make-fixture";

function captureFolder(overrides: Record<string, unknown> = {}): string {
  const run = mkdtempSync(join(tmpdir(), "walkthrough-test-"));
  mkdirSync(join(run, "shots"));
  for (const step of fixtureSteps) writeFileSync(join(run, step.shot!), "png");
  writeFileSync(join(run, "video.webm"), "webm");
  writeFileSync(join(run, "steps.json"), JSON.stringify(fixtureSteps));
  writeFileSync(
    join(run, "capture.json"),
    JSON.stringify({ version: 1, walk: "w", env: "local", title: "T", startedAt: "2026-10-05T00:00:00Z", viewport: { w: 1440, h: 900 }, status: "passed", ...overrides }),
  );
  return run;
}

describe("prepare", () => {
  test("a passed capture yields chapters next to the output", () => {
    const run = captureFolder();
    const prepared = prepare(run);
    expect(prepared.out).toBe(join(run, "walkthrough.mp4"));
    expect(prepared.chaptersPath).toBe(join(run, "chapters.txt"));
    expect(prepared.chaptersText.split("\n")[0]).toBe("0:02  Open the form");
  });

  test("a failed walk never renders", () => {
    const run = captureFolder({ status: "failed", failedStep: "save" });
    expect(() => prepare(run)).toThrow(RenderRefusal);
    expect(() => prepare(run)).toThrow(/at step "save"/);
  });

  test("a missing shot is refused", () => {
    const run = captureFolder();
    writeFileSync(join(run, "steps.json"), JSON.stringify([{ ...fixtureSteps[0], shot: "shots/nope.png" }]));
    expect(() => prepare(run)).toThrow(/shots\/nope.png is missing/);
  });

  test("an output inside this repo is refused, and so is a capture folder inside it", () => {
    const roots = repoRoots();
    const run = captureFolder();
    const inRepo = join(roots[roots.length - 1], "tiles", "x", "walkthrough.mp4");
    expect(() => prepare(run, inRepo, roots)).toThrow(/inside this repo/);
    expect(insideAny(resolve(import.meta.dir), roots)).toBe(true);
    expect(insideAny(run, roots)).toBe(false);
  });
});

describe("parseArgs", () => {
  test("unknown, duplicate and incomplete options cannot be silently ignored", () => {
    for (const argv of [["/run", "--unknown"], ["/run", "--out"], ["/run", "--out", "--stills"],
      ["/a", "/b"], ["/run", "--out", "/a", "--out", "/b"], ["/run", "--speed", "NaN"]])
      expect(() => parseArgs(argv)).toThrow(RenderRefusal);
  });
  test("the folder is found with or without --out, before or after it", () => {
    expect(parseArgs(["/run"])).toMatchObject({ run: "/run", out: undefined, dryRun: false });
    expect(parseArgs(["/run", "--out", "/x.mp4"])).toMatchObject({ run: "/run", out: "/x.mp4", dryRun: false });
    expect(parseArgs(["--out", "/x.mp4", "/run", "--dry-run"])).toMatchObject({ run: "/run", out: "/x.mp4", dryRun: true });
    expect(parseArgs(["--calibration-ms", "-250", "/run"])).toMatchObject({ run: "/run", calibrationMs: -250 });
  });
});

describe("final render validation", () => {
  test("checked evidence omissions are refused by every valid argument ordering", async () => {
    const run = captureFolder();
    const step = { ...fixtureSteps[0], focus: [], targets: {
      total: { boxes: [{ x: 10, y: 10, w: 100, h: 30 }], fromMs: fixtureSteps[0].startMs, toMs: fixtureSteps[0].endMs },
    }, evidence: { total: { kind: "dollarMinor", expected: 200000 } } };
    writeFileSync(join(run, "steps.json"), JSON.stringify([step]));
    expect(() => prepare(run)).toThrow(/omits checked evidence/);
    expect(await main([run, "--dry-run"])).toBe(3);
    expect(await main(["--dry-run", run])).toBe(3);
  });

  test("narrated dry-run does not fetch, load voice credentials or write files", async () => {
    const run = captureFolder();
    const before = readdirSync(run, { recursive: true });
    const previous = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = Object.assign(async () => { calls++; throw Error("Provider call forbidden"); }, { preconnect: previous.preconnect });
    try {
      expect(await main(["--dry-run", run, "--narrate", "--voice-profile", "missing-test-profile"])).toBe(0);
      expect(calls).toBe(0);
      expect(readdirSync(run, { recursive: true })).toEqual(before);
    } finally { globalThis.fetch = previous; }
  });
});

describe("conversational script", () => {
  test("narration notices require a separate opt-in", () => {
    expect(parseArgs(["/run", "--narrate"]).narrationNotice).toBe(false);
    expect(parseArgs(["/run", "--narrate", "--narration-notice"]).narrationNotice).toBe(true);
    expect(() => parseArgs(["/run", "--narration-notice", "--narration-notice"])).toThrow(/Duplicate/);
  });
  test("--script takes a path and implies --narrate", () => {
    expect(parseArgs(["/run", "--script", "/s.json"])).toMatchObject({ run: "/run", script: "/s.json", narrate: true });
    expect(parseArgs(["--script", "/s.json", "/run"])).toMatchObject({ run: "/run", narrate: true });
    expect(parseArgs(["/run"])).toMatchObject({ script: undefined, narrate: false });
  });

  test("--speed takes a number, and is left to the default otherwise", () => {
    expect(parseArgs(["/run", "--narrate", "--speed", "1.15"])).toMatchObject({ run: "/run", speed: 1.15 });
    expect(parseArgs(["--speed", "0.9", "/run"])).toMatchObject({ run: "/run", speed: 0.9 });
    expect(parseArgs(["/run"]).speed).toBeUndefined();
  });

  test("a script inside this repo is refused: it is run material", () => {
    const roots = repoRoots();
    const inRepo = join(roots[roots.length - 1], "tiles", "x", "script.json");
    expect(() => readScript(inRepo, fixtureSteps, roots)).toThrow(RenderRefusal);
    const outside = join(captureFolder(), "narration.conversational.json");
    writeFileSync(outside, JSON.stringify({ intro: "Hi.", steps: { open: "Let's open it." } }));
    expect(readScript(outside, fixtureSteps, roots)).toEqual({ intro: "Hi.", steps: { open: "Let's open it." } });
  });

  test("an opening line lengthens the title card, and the chapters follow", () => {
    const run = captureFolder();
    expect(prepare(run, undefined, repoRoots(), undefined, { titleMs: 6000 }).chaptersText.split("\n")[0]).toBe(
      "0:06  Open the form",
    );
  });
});

const hasFfmpeg = (() => {
  try {
    require("child_process").execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("sync flash", () => {
  test("a capture declaring a sync marker cannot silently render with an unknown offset", () => {
    const run = captureFolder({ sync: { tMs: 500 } });
    expect(() => prepare(run)).toThrow(/Could not find the recorded sync marker/);
    expect(prepare(run, undefined, repoRoots(), 0).calibrationSource).toBe("argument");
  });

  test.skipIf(!hasFfmpeg)("the skew between the capture clock and the recording is measured and taken off", () => {
    const run = makeFixture(mkdtempSync(join(tmpdir(), "walkthrough sync 中文 ' -")));
    const offset = detectSyncOffset(join(run, "video.webm"), SKEW_MS + 400)!;
    expect(Math.abs(offset + SKEW_MS)).toBeLessThanOrEqual(40); // one frame at 25 fps
    const prepared = prepare(run);
    expect(prepared.calibrationSource).toBe("sync flash");
    expect(prepared.chaptersText.split("\n")[0]).toBe("0:02  Open the form");
    expect(prepare(run, undefined, repoRoots(), 0).calibrationSource).toBe("argument");
  }, 30_000); // Real encoding/probing can exceed Bun's 5-second default under CPU load.

  test("no flash, no offset", () => {
    expect(detectSyncOffset("/nonexistent/video.webm", 400)).toBeNull();
  });
});
