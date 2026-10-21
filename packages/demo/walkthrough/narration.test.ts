import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import { readingMs, type Step } from "../remotion/src/projects/walkthrough-video/timeline";
import {
  NARRATION_PAD_MS,
  WALKTHROUGH_SPEED,
  cardMinMs,
  loadApiKey,
  loadScript,
  loadVoiceProfile,
  narrate,
  narrationText,
  stepMinMs,
  withSpeed,
  type VoiceProfile,
} from "./narration";

const step = (caption: string, extra: Partial<Step> = {}): Step => ({
  id: caption,
  caption,
  kind: "action",
  startMs: 0,
  endMs: 1000,
  clicks: [],
  shot: null,
  ...extra,
});

const profile: VoiceProfile = {
  voice_id: "voice",
  model_id: "model",
  output_format: "mp3_44100_192",
  voice_settings: { stability: 0.5 },
};

const tmp = () => mkdtempSync(join(tmpdir(), "narration-test-"));

describe("narrationText", () => {
  test("says the caption unless the step has its own words", () => {
    expect(narrationText(step("Open the form"))).toBe("Open the form");
    expect(narrationText(step("Open the form", { narration: "  Now open the form.  " }))).toBe("Now open the form.");
    expect(narrationText(step("Open the form", { narration: "  " }))).toBe("Open the form");
  });
});

describe("loadApiKey", () => {
  test("uses the dedicated Keychain when no environment key is set", () => {
    const dir = tmp();
    writeFileSync(join(dir, ".env"), "ELEVENLABS_API_KEY=from-env\n");
    expect(loadApiKey([join(dir, ".env")], () => "from-keychain", {})).toBe("from-keychain");
  });

  test("falls back to the first .env that has the key, quotes removed", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.env"), "OTHER=1\n");
    writeFileSync(join(dir, "b.env"), 'OTHER=1\nELEVENLABS_API_KEY="from-env"\n');
    expect(loadApiKey([join(dir, "missing.env"), join(dir, "a.env"), join(dir, "b.env")], () => null, {})).toBe("from-env");
  });

  test("says how to add the key when there is none, without guessing one", () => {
    expect(() => loadApiKey([], () => null, {})).toThrow(/security add-generic-password -s aaron-demo-elevenlabs/);
  });

  test("uses the process environment without requiring a repository secret file", () => {
    expect(loadApiKey([], () => null, { ELEVENLABS_API_KEY: "  process-key  " })).toBe("process-key");
    expect(loadApiKey([], () => "keychain-key", { ELEVENLABS_API_KEY: "process-key" })).toBe("process-key");
  });
});

describe("loadVoiceProfile", () => {
  test("reads the default profile, and refuses an unknown or unsupported provider", () => {
    const dir = tmp();
    const path = join(dir, "profiles.json");
    writeFileSync(
      path,
      JSON.stringify({
        default_profile: "me",
        profiles: { me: { provider: "elevenlabs", ...profile }, other: { provider: "say", voice_id: "x" } },
      }),
    );
    expect(loadVoiceProfile(undefined, path)).toMatchObject({ name: "me", voice_id: "voice" });
    expect(() => loadVoiceProfile("nope", path)).toThrow(/No voice profile "nope"/);
    expect(() => loadVoiceProfile("other", path)).toThrow(/Unknown voice provider/);
  });
});

describe("narrate", () => {
  test("writes one clip per step and reuses it on the next render", async () => {
    const run = tmp();
    const said: string[] = [];
    const synthesize = async (text: string) => {
      said.push(text);
      return new TextEncoder().encode(text);
    };
    const probe = (path: string) => (basename(path).startsWith("01-") ? 1500 : 4200);
    const steps = [step("Open the form"), step("Save it", { narration: "Then save it." })];

    const first = await narrate(run, steps, profile, synthesize, probe);
    expect(said).toEqual(["Open the form", "Then save it."]);
    expect(first.map((c) => [c.at, c.ms, c.text])).toEqual([
      [0, 1500, "Open the form"],
      [1, 4200, "Then save it."],
    ]);
    expect(first[0].file).toMatch(/^narration\/01-[0-9a-f]{12}\.mp3$/);
    expect(existsSync(join(run, first[1].file))).toBe(true);

    const again = await narrate(run, steps, profile, synthesize, probe);
    expect(said).toHaveLength(2);
    expect(again).toEqual(first);
  });

  test("new words or another voice make a new clip", async () => {
    const run = tmp();
    const synthesize = async (text: string) => new TextEncoder().encode(text);
    const probe = () => 1000;
    const [a] = await narrate(run, [step("Open the form")], profile, synthesize, probe);
    const [b] = await narrate(run, [step("Open the new form")], profile, synthesize, probe);
    const [c] = await narrate(run, [step("Open the form")], { ...profile, voice_id: "other" }, synthesize, probe);
    expect(new Set([a.file, b.file, c.file]).size).toBe(3);
  });
});

describe("stepMinMs", () => {
  test("a step stays up for its reading time or its clip and a pause, whichever is longer", () => {
    const steps = [step("Open the form"), step("Save it")];
    const clips = [{ at: 1, file: "narration/02-x.mp3", ms: 5000, text: "Save it" }];
    expect(stepMinMs(steps, clips)).toEqual([readingMs("Open the form"), 5000 + NARRATION_PAD_MS]);
    expect(stepMinMs(steps)).toEqual([readingMs("Open the form"), readingMs("Save it")]);
  });
});

describe("conversational script", () => {
  const steps = [step("Open the form", { id: "open" }), step("Save it", { id: "save" }), step("Saved", { id: "done" })];
  const write = (body: unknown) => {
    const path = join(tmp(), "script.json");
    writeFileSync(path, JSON.stringify(body));
    return path;
  };

  test("reads an opening line, lines by step id and a closing line; a blank line is silence", () => {
    const script = loadScript(
      write({ intro: "  Hi, a quick tour.  ", steps: { open: "Let's open the form.", save: "  " }, outro: "That's it." }),
      steps,
    );
    expect(script).toEqual({ intro: "Hi, a quick tour.", steps: { open: "Let's open the form." }, outro: "That's it." });
  });

  test("refuses a line for a step the capture does not have, and a script that is not one", () => {
    expect(() => loadScript(write({ steps: { open: "x", nope: "y", gone: "z" } }), steps)).toThrow(
      /no step "nope", "gone"/,
    );
    expect(() => loadScript(write({ steps: ["x"] }), steps)).toThrow(/steps must map step ids to lines/);
    expect(() => loadScript(write({ intro: 3, steps: {} }), steps)).toThrow(/intro must be text/);
  });

  test("speaks the script instead of the captions: steps without a line stay silent", async () => {
    const run = tmp();
    const said: string[] = [];
    const synthesize = async (text: string) => {
      said.push(text);
      return new TextEncoder().encode(text);
    };
    const probe = (path: string) => (path.includes("intro") ? 3000 : path.includes("outro") ? 2500 : 4000);
    const clips = await narrate(run, steps, profile, synthesize, probe, {
      intro: "Hi, a quick tour.",
      steps: { save: "Now we save it, and it takes a moment." },
      outro: "That's it.",
    });
    expect(said).toEqual(["Hi, a quick tour.", "Now we save it, and it takes a moment.", "That's it."]);
    expect(clips.map((c) => [c.at, c.ms])).toEqual([
      ["intro", 3000],
      [1, 4000],
      ["outro", 2500],
    ]);
    expect(clips[0].file).toMatch(/^narration\/intro-[0-9a-f]{12}\.mp3$/);
    expect(clips[2].file).toMatch(/^narration\/outro-[0-9a-f]{12}\.mp3$/);
    // "Saved" has no line, so the save line's 4.4 s is shared by "Save it" and "Saved".
    expect(stepMinMs(steps, clips)).toEqual([readingMs("Open the form"), 2200, 2200]);
    expect(cardMinMs(clips)).toEqual({ titleMs: 3000 + NARRATION_PAD_MS, endMs: 2500 + NARRATION_PAD_MS });
    expect(cardMinMs([])).toEqual({ titleMs: 0, endMs: 0 });
  });

  test("a line plays on over the silent steps after it: its time is shared, so the clicks happen as it is said", () => {
    const three = [step("Open the form", { id: "a" }), step("Save it", { id: "b" }), step("Saved", { id: "c" })];
    // Each caption reads in 2 s; the line and its pause take 9 s, shared evenly by reading time.
    const clip = { at: 0, file: "narration/01-x.mp3", ms: 9000 - NARRATION_PAD_MS, text: "x" };
    expect(stepMinMs(three, [clip])).toEqual([3000, 3000, 3000]);
    // A later line starts its own group.
    const next = { at: 2, file: "narration/03-x.mp3", ms: 1000, text: "y" };
    expect(stepMinMs(three, [{ ...clip, ms: 6000 - NARRATION_PAD_MS }, next])).toEqual([3000, 3000, 2000]);
    // Silent steps before the first line only need their reading time.
    expect(stepMinMs(three, [{ ...clip, at: 1, ms: 6000 - NARRATION_PAD_MS }])).toEqual([2000, 3000, 3000]);
  });
});

describe("speaking speed", () => {
  test("walkthroughs speak a little faster than the profile, and any speed ElevenLabs takes can be asked for", () => {
    expect(WALKTHROUGH_SPEED).toBe(1.15);
    expect(withSpeed(profile, 1.15).voice_settings).toEqual({ stability: 0.5, speed: 1.15 });
    expect(profile.voice_settings).toEqual({ stability: 0.5 });
    expect(() => withSpeed(profile, 1.3)).toThrow(/between 0.7 and 1.2/);
    expect(() => withSpeed(profile, Number.NaN)).toThrow(/between 0.7 and 1.2/);
  });

  test("another speed makes new clips", async () => {
    const run = tmp();
    const synthesize = async (text: string) => new TextEncoder().encode(text);
    const [a] = await narrate(run, [step("Open the form")], withSpeed(profile, 1.0), synthesize, () => 1000);
    const [b] = await narrate(run, [step("Open the form")], withSpeed(profile, 1.1), synthesize, () => 1000);
    expect(a.file).not.toBe(b.file);
  });
});
