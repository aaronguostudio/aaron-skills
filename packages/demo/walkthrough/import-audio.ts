import {copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync} from 'fs';
import {createHash} from 'crypto';
import {dirname, extname, join, resolve, sep} from 'path';
import {ffprobeMs, type NarrationClip, type ProbeMs} from './narration';
import type {Step} from '../remotion/src/projects/walkthrough-video/timeline';

export function outsideGit(path: string): void {
  let probe = resolve(path);
  while (!existsSync(probe)) probe = dirname(probe);
  probe = realpathSync(probe);
  while (true) {
    if (existsSync(join(probe, '.git'))) throw Error('Run material and outputs must stay outside every Git repository');
    if (dirname(probe) === probe) break;
    probe = dirname(probe);
  }
}

export type ImportedAudio = {aiGenerated: boolean; clips: Array<NarrationClip & {source: string}>};

export function readImportedAudio(manifest: string, steps: Step[], probe: ProbeMs = ffprobeMs): ImportedAudio {
  outsideGit(manifest);
  const base = dirname(realpathSync(manifest));
  const data = JSON.parse(readFileSync(manifest, 'utf8'));
  if (data.version !== 1 || !Array.isArray(data.clips) || !data.clips.length || (data.aiGenerated !== undefined && typeof data.aiGenerated !== 'boolean')) throw Error('Audio manifest needs version:1, clips and optional aiGenerated:boolean');
  const ids = new Map(steps.map((s,i) => [s.id,i]));
  const seen = new Set<string>();
  const clips = data.clips.map((clip: {at: string; file: string; text: string}) => {
    if (!clip || typeof clip.at !== 'string' || seen.has(clip.at) || (clip.at !== 'intro' && clip.at !== 'outro' && !ids.has(clip.at))) throw Error('Audio clip has a duplicate or unknown step/card ID');
    seen.add(clip.at);
    if (typeof clip.file !== 'string' || !/\.(wav|mp3|m4a|aiff?)$/i.test(clip.file) || /^(\/|[a-z]+:)/i.test(clip.file) || clip.file.split(/[\\/]/).includes('..')) throw Error('Imported audio must be a relative local WAV, MP3, M4A or AIFF file');
    if (typeof clip.text !== 'string' || !clip.text.trim()) throw Error('Each imported clip needs its transcript for review');
    const source = realpathSync(resolve(base, clip.file));
    if (!source.startsWith(base + sep)) throw Error('Imported audio leaves its manifest directory');
    outsideGit(source);
    const ms = probe(source);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 600000) throw Error('Imported audio duration must be positive and at most ten minutes per clip');
    const hash = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0,20);
    const at = clip.at === 'intro' || clip.at === 'outro' ? clip.at : ids.get(clip.at)!;
    return {at, source, file:`narration/import-${hash}${extname(source).toLowerCase()}`, ms, text:clip.text.trim()};
  });
  return {aiGenerated:data.aiGenerated ?? false, clips};
}

export function installImportedAudio(audio: ImportedAudio, run: string): NarrationClip[] {
  mkdirSync(join(run,'narration'), {recursive:true});
  return audio.clips.map(({source, ...clip}) => {copyFileSync(source,join(run,clip.file)); return clip;});
}
