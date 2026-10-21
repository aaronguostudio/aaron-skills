// Narration timing and cache shared by every user-selected speech provider.
// Measured clip lengths determine screen holds and chapters; visible notices are opt-in.
//
// Two styles:
// - concise (default): each step's `narration`, else its caption, one clip per step;
// - conversational: a script written for the run (loadScript), with an opening line over the title
//   card, lines for the steps it chooses (a step without one stays silent) and a closing line.
//
// The CLI reads the process environment and optional dedicated macOS Keychain service.
// It never discovers another project's credentials or a repository .env automatically.
import { execFileSync } from "child_process";
import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { dirname, join, resolve } from "path";
import {profilePath, readConfig, validateProfile, type VoiceProfile} from './voice-config';
export type {VoiceProfile} from './voice-config';
import { readingMs, type Step } from "../remotion/src/projects/walkthrough-video/timeline";

export const KEYCHAIN_SERVICE = "aaron-demo-elevenlabs";
export const NARRATION_PAD_MS = 400;
// Walkthroughs default to a slightly faster pace.
// ElevenLabs takes speeds from 0.7 to 1.2.
export const WALKTHROUGH_SPEED = 1.15;
const SPEED_MIN = 0.7;
const SPEED_MAX = 1.2;

// Where a clip plays: a step's index, or over the title or end card.
export type ClipAt = number | "intro" | "outro";
export type NarrationClip = { at: ClipAt; file: string; ms: number; text: string };

// A conversational script: lines keyed by step id. Run material, so it lives in the run folder.
export type NarrationScript = { intro?: string; steps: Record<string, string>; outro?: string };

export type Synthesize = (text: string, profile: VoiceProfile) => Promise<Uint8Array>;
export type ProbeMs = (path: string) => number;

export function loadVoiceProfile(name?: string, path = profilePath()): VoiceProfile & { name: string } {
  if (!existsSync(path)) throw new Error('No voice profiles yet. Run aaron-demo voice setup: choose ElevenLabs, Google, your company endpoint or free local Kokoro. Silent/imported rendering needs no profile.');
  const config = readConfig(path);
  const id = name ?? config.default_profile;
  const profile = id ? config.profiles?.[id] : undefined;
  if (!profile) throw new Error(`No voice profile "${id}" in ${path}`);
  validateProfile(profile);
  return { ...profile, name: id! };
}

// The profile with another speaking speed; the profile itself is left as it is.
export function withSpeed<P extends VoiceProfile>(profile: P, speed: number): P {
  if (!(speed >= SPEED_MIN && speed <= SPEED_MAX)) {
    throw new Error(`Speaking speed must be between ${SPEED_MIN} and ${SPEED_MAX} (got ${speed})`);
  }
  return { ...profile, voice_settings: { ...profile.voice_settings, speed } };
}

export function narrationText(step: Step): string {
  return (step.narration ?? "").trim() || step.caption.trim();
}

export function loadScript(path: string, steps: Step[]): NarrationScript {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const text = (value: unknown, name: string): string | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") throw new Error(`${path}: ${name} must be text`);
    return value.trim() || undefined;
  };
  if (!raw || typeof raw.steps !== "object" || raw.steps === null || Array.isArray(raw.steps)) {
    throw new Error(`${path}: steps must map step ids to lines`);
  }
  const ids = new Set(steps.map((s) => s.id));
  const unknown = Object.keys(raw.steps).filter((id) => !ids.has(id));
  if (unknown.length) {
    throw new Error(`${path}: the capture has no step ${unknown.map((id) => `"${id}"`).join(", ")}`);
  }
  const lines: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw.steps)) {
    const line = text(value, `steps.${id}`);
    if (line) lines[id] = line;
  }
  const script: NarrationScript = { steps: lines };
  const intro = text(raw.intro, "intro");
  const outro = text(raw.outro, "outro");
  if (intro) script.intro = intro;
  if (outro) script.outro = outro;
  return script;
}

// The key never leaves this function except into the request header.
export function loadApiKey(envFiles: string[], keychain: () => string | null = readKeychain, environment: Record<string, string | undefined> = process.env): string {
  const fromEnvironment = environment.ELEVENLABS_API_KEY?.trim();
  if (fromEnvironment) return fromEnvironment;
  const fromKeychain = keychain();
  if (fromKeychain) return fromKeychain;
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.startsWith("ELEVENLABS_API_KEY="));
    const value = line?.slice("ELEVENLABS_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  throw new Error(
    `No ElevenLabs key: run aaron-demo voice setup to connect your account or choose Google, your company endpoint, free local Kokoro or imported audio. Legacy setup: security add-generic-password -s ${KEYCHAIN_SERVICE} -a $USER -w, or set ELEVENLABS_API_KEY in the process environment.`,
  );
}

function readKeychain(): string | null {
  try {
    return execFileSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

export function elevenLabs(apiKey: string): Synthesize {
  return async (text, profile) => {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(profile.voice_id)}?output_format=${encodeURIComponent(profile.output_format)}`;
    let response:Response;
    try {response = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: profile.model_id, voice_settings: profile.voice_settings }),
      redirect:'error', signal:AbortSignal.timeout(120000),
    });}catch{throw Error('ElevenLabs could not be reached or timed out. Script and completed clips are retained. Retry or run aaron-demo voice setup to choose another route; no fallback was selected.');}
    if (!response.ok) {
      throw new Error(`ElevenLabs answered ${response.status}; check API key, voice access, quota and model. No response body or credentials were logged. Retry or run aaron-demo voice setup; completed clips are retained.`);
    }
    return new Uint8Array(await response.arrayBuffer());
  };
}

export const ffprobeMs: ProbeMs = (path) => {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], {
    encoding: "utf8",
  });
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`Could not measure ${path}`);
  return Math.round(seconds * 1000);
};

// The clips, cached in <run>/narration by text and voice, so a re-render costs nothing. Without a
// script, one per step; with one, its lines only.
export async function narrate(
  run: string,
  steps: Step[],
  profile: VoiceProfile,
  synthesize: Synthesize,
  probe: ProbeMs = ffprobeMs,
  script?: NarrationScript,
): Promise<NarrationClip[]> {
  const stepName = (i: number) => String(i + 1).padStart(2, "0");
  const lines: Array<{ at: ClipAt; name: string; text: string }> = script
    ? [
        ...(script.intro ? [{ at: "intro" as const, name: "intro", text: script.intro }] : []),
        ...steps.flatMap((step, i) => {
          const line = script.steps[step.id];
          return line ? [{ at: i, name: stepName(i), text: line }] : [];
        }),
        ...(script.outro ? [{ at: "outro" as const, name: "outro", text: script.outro }] : []),
      ]
    : steps.map((step, i) => ({ at: i, name: stepName(i), text: narrationText(step) }));
  const clips: NarrationClip[] = [];
  for (const { at, name, text } of lines) {
    // Preserve legacy ElevenLabs cache identities so an upgrade alone cannot incur usage.
    const identity:unknown[]=[profile.provider??'elevenlabs',profile.voice_id,profile.model_id,profile.output_format,profile.voice_settings];
    const scope={endpoint:profile.endpoint,credential:profile.credential_id,keyEnvironment:profile.api_key_env,auth:profile.auth,modelPath:profile.model_path,voicesPath:profile.voices_path,language:profile.language};
    if(Object.values(scope).some(value=>value!==undefined))identity.push(scope);
    identity.push(text);
    const key = createHash("sha256")
      .update(JSON.stringify(identity))
      .digest("hex")
      .slice(0, 12);
    const file = `narration/${name}-${key}.mp3`;
    const path = join(run, file);
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      const pending = `${path}.${randomUUID()}.tmp`;
      try {
        writeFileSync(pending, await synthesize(text, profile));
        probe(pending); // Never cache a truncated or non-audio provider response.
        renameSync(pending, path);
      } finally {if (existsSync(pending)) unlinkSync(pending);}
    }
    clips.push({ at, file, ms: probe(path), text });
  }
  return clips;
}

// The least time each step stays on screen: its caption's reading time, and long enough for the
// voice. A line plays on over the silent steps after it, as a person keeps talking while clicking,
// so its time (clip and a pause) is shared across that run of steps by their reading times.
export function stepMinMs(steps: Step[], clips: NarrationClip[] = []): number[] {
  const mins = steps.map((step) => readingMs(step.caption));
  const starts = clips.filter((c): c is NarrationClip & { at: number } => typeof c.at === "number");
  for (const clip of starts) {
    let end = clip.at + 1;
    while (end < steps.length && !starts.some((c) => c.at === end)) end++;
    const group = mins.slice(clip.at, end);
    const reading = group.reduce((sum, ms) => sum + ms, 0);
    const voice = clip.ms + NARRATION_PAD_MS;
    group.forEach((ms, k) => {
      mins[clip.at + k] = Math.max(ms, Math.ceil((voice * ms) / reading));
    });
  }
  return mins;
}

// The least time the title and end cards stay up: their line and a pause (0 without one). When a
// brand's sting plays under the opening card, the line waits for it, so the card carries both.
export function cardMinMs(
  clips: NarrationClip[],
  stingLeadMs = 0,
): { titleMs: number; endMs: number } {
  const card = (at: "intro" | "outro") => {
    const clip = clips.find((c) => c.at === at);
    return clip ? clip.ms + NARRATION_PAD_MS : 0;
  };
  const titleMs = card("intro");
  return { titleMs: titleMs > 0 ? titleMs + stingLeadMs : titleMs, endMs: card("outro") };
}
