import {existsSync, readFileSync, lstatSync, realpathSync, renameSync, writeFileSync, unlinkSync} from 'node:fs';
import {dirname, join, isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {privateDirectory, privatePath} from '../capture/scripts/platform.mjs';

export const PROVIDERS = ['elevenlabs', 'google', 'custom', 'kokoro'] as const;
export type ProviderId = typeof PROVIDERS[number];
export type VoiceProfile = {
  provider?: string; voice_id: string; model_id: string; output_format: string;
  voice_settings: Record<string, number | boolean>;
  api_key_env?: string; credential_id?: string; endpoint?: string; auth?: 'none';
  python?: string; model_path?: string; voices_path?: string; language?: string;
};
export type VoiceConfig = {default_profile?: string; profiles: Record<string, VoiceProfile>};
export const profilePath = () => process.env.AARON_DEMO_VOICE_PROFILES || join(homedir(), '.config', 'aaron-skills', 'demo', 'voice-profiles.json');
export const credentialPath = () => join(dirname(profilePath()), 'voice-credentials.json');

// Walk existing ancestors as well as symlink targets; never save config/run material in Git.
export function externalPath(file: string): void {
  if (!isAbsolute(file)) throw Error('Voice paths must be absolute');
  if(existsSync(file)&&lstatSync(file).isSymbolicLink())throw Error('Voice configuration/output must not be a symlink');
  let at = file;
  while(!existsSync(at))at=dirname(at);
  at=realpathSync(at);
  for (;;) {
    if (existsSync(join(at, '.git'))) throw Error('Voice configuration, credentials and outputs must stay outside every Git repository');
    const parent = dirname(at); if (parent === at) break; at = parent;
  }
}
export function validateEndpoint(value: string): string {
  let url: URL; try {url = new URL(value);} catch {throw Error('Enter a valid speech endpoint URL');}
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
    throw Error('Speech endpoints need HTTPS (HTTP is allowed only on loopback), without credentials, query or fragment');
  }
  return url.href;
}
export function validateProfile(profile: VoiceProfile): void {
  if (!profile || !PROVIDERS.includes(profile.provider as ProviderId)) throw Error('Unknown voice provider; run aaron-demo voice setup');
  if (![profile.voice_id, profile.model_id, profile.output_format].every(v => typeof v === 'string' && v.trim()) || !profile.output_format.startsWith('mp3_') || !profile.voice_settings || typeof profile.voice_settings !== 'object' || Array.isArray(profile.voice_settings)) throw Error('Voice profile needs voice/model IDs, MP3 output_format and voice_settings');
  if (profile.api_key_env && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(profile.api_key_env)) throw Error('Invalid API key environment variable name');
  if(Object.values(profile.voice_settings).some(v=>typeof v!=='boolean'&&(typeof v!=='number'||!Number.isFinite(v))))throw Error('Voice settings must contain finite numbers or booleans');
  if (profile.credential_id && !/^[a-zA-Z0-9-]+$/.test(profile.credential_id)) throw Error('Invalid credential reference');
  if (profile.provider === 'custom') validateEndpoint(profile.endpoint ?? '');
  if (profile.provider === 'kokoro') {
    if(!['en-us','en-gb'].includes(profile.language??'en-us'))throw Error('The local Kokoro route currently validates English only: en-us or en-gb');
    if(!(profile.language==='en-gb'?/^b[fm]_/:/^a[fm]_/).test(profile.voice_id))throw Error('Choose a local English voice matching en-us (af_/am_) or en-gb (bf_/bm_)');
    for (const file of [profile.python, profile.model_path, profile.voices_path]) {
      if (!file || !isAbsolute(file) || !existsSync(file)) throw Error('Local Kokoro is not installed; run aaron-demo voice install-local');
    }
  }
}
export function readConfig(file = profilePath()): VoiceConfig {
  if (!existsSync(file)) return {profiles: {}};
  externalPath(file);
  let config: VoiceConfig; try {config = JSON.parse(readFileSync(file, 'utf8'));} catch {throw Error('Voice configuration is invalid; preserve it and run aaron-demo voice setup with a new --profiles path');}
  if (!config || !config.profiles || typeof config.profiles !== 'object' || Array.isArray(config.profiles)) throw Error('Voice configuration needs profiles');
  return config;
}
export async function privateJson(file: string, data: unknown): Promise<void> {
  externalPath(file);
  // Existing parent directories may be shared (for example the system temp directory).
  // Restrict new directories and each file, without changing an existing parent's permissions.
  if(!existsSync(dirname(file)))await privateDirectory(dirname(file));
  const pending = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(pending, JSON.stringify(data, null, 2) + '\n', {flag:'wx', mode:0o600});
    await privatePath(pending); renameSync(pending, file);
  } finally {if (existsSync(pending)) unlinkSync(pending);}
}
export async function saveProfile(name: string, profile: VoiceProfile, options: {replace?: boolean; makeDefault?: boolean} = {}): Promise<void> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name) || ['constructor','prototype','__proto__'].includes(name)) throw Error('Profile names use 1–64 letters, numbers, hyphens or underscores; reserved object names are refused');
  validateProfile(profile);
  await updateConfig(config=>{
    if (Object.hasOwn(config.profiles, name) && !options.replace) throw Error(`Profile ${name} already exists; choose a new name or explicitly use --replace`);
    config.profiles[name] = profile;
    if (!config.default_profile || options.makeDefault) config.default_profile = name;
  });
}
// Serialize the entire read/modify/write, including across separate CLI processes.
async function locked<T>(file:string,action:()=>Promise<T>):Promise<T>{
  externalPath(file);if(!existsSync(dirname(file)))await privateDirectory(dirname(file));
  const lock=file+'.lock',token=`${process.pid}:${randomUUID()}`;externalPath(lock);
  const deadline=Date.now()+30000;
  for(;;){
    try{writeFileSync(lock,token,{flag:'wx',mode:0o600});break;}catch(error){
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      if(Date.now()>=deadline)throw Error(`Voice configuration is busy. Retry after the other command exits. If a command crashed, inspect and remove the stale lock: ${lock}`);
      await new Promise(resolve=>setTimeout(resolve,25));
    }
  }
  try{await privatePath(lock);return await action();}
  finally{if(existsSync(lock)&&readFileSync(lock,'utf8')===token)unlinkSync(lock);}
}
export async function updateConfig(update:(config:VoiceConfig)=>void):Promise<void>{
  const file=profilePath();await locked(file,async()=>{const config=readConfig(file);update(config);await privateJson(file,config);});
}
export function savedKey(id?: string): string | undefined {
  if (!id || !existsSync(credentialPath())) return undefined;
  externalPath(credentialPath());
  const keys = readKeys(credentialPath());
  return typeof keys[id] === 'string' ? keys[id] : undefined;
}
export async function saveKey(key: string): Promise<string> {
  const file = credentialPath(); externalPath(file);
  return locked(file,async()=>{
    const keys = existsSync(file) ? readKeys(file) : {};
    const id = randomUUID(); keys[id] = key; await privateJson(file, keys); return id;
  });
}
function readKeys(file:string):Record<string,string>{
  try {const keys=JSON.parse(readFileSync(file,'utf8'));if(!keys||typeof keys!=='object'||Array.isArray(keys))throw Error();return keys;}
  catch {throw Error('The private voice credential file is invalid; no credentials were printed. Restore that file or use an API key environment variable.');}
}
