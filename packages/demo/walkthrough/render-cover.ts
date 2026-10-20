#!/usr/bin/env bun
import {execFileSync,spawnSync} from 'child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'fs';
import {dirname,extname,join,resolve} from 'path';
import {coverColors,coverPresets} from '../covers/catalog';
import {privateDirectory} from '../capture/scripts/platform.mjs';
import {outsideGit} from './import-audio';
import {installPresentation,loadPresentation,validatePresentationMedia} from './presentation';

const HELP='usage: aaron-demo cover --list | --presentation <external.json> [--preset <id>] --out <cover.png> [--dry-run]';
export function parseCoverArgs(argv:string[]) {
  const values:Record<string,string>={};const flags=new Set<string>();
  for(let i=0;i<argv.length;i++) {
    const key=argv[i];
    if(key in values || flags.has(key)) throw Error(`Duplicate option: ${key}`);
    if(['--list','--dry-run','--help','-h'].includes(key)) flags.add(key);
    else if(['--presentation','--preset','--out'].includes(key)) {
      const value=argv[++i];if(!value || value.startsWith('--')) throw Error(`${key} needs a value`);values[key]=value;
    } else throw Error(`Unknown cover option: ${key}`);
  }
  return {values,flags};
}

export async function main(argv:string[]):Promise<number> {
  let workspace:string|undefined;
  try {
    const {values,flags}=parseCoverArgs(argv);
    if(flags.has('--help') || flags.has('-h') || !argv.length) {console.log(HELP);return 0;}
    if(flags.has('--list')) {
      if(Object.keys(values).length || flags.size!==1) throw Error('--list cannot be combined with render options');
      console.log(JSON.stringify(coverPresets.map(({id,title,family,familyTitle,colors,preview})=>({id,title,family,familyTitle,colors,preview})),null,2));return 0;
    }
    const file=values['--presentation'],output=values['--out'];
    if(!file || !output) throw Error(HELP);
    outsideGit(file);outsideGit(output);
    if(extname(output).toLowerCase()!=='.png') throw Error('--out must name a PNG file; a sibling WebP is exported too');
    const raw=JSON.parse(readFileSync(file,'utf8'));
    if(!raw || typeof raw!=='object' || Array.isArray(raw) || typeof raw.title!=='string' || !raw.title.trim()) throw Error('A standalone cover needs your title in the presentation configuration');
    const loaded=loadPresentation(undefined,file,raw.title,'',values['--preset'])!;
    const p=loaded.presentation;
    if(!p.cover) throw Error('Select a cover preset in cover.preset or --preset. Run aaron-demo cover --list.');
    // Cover-only authoring never creates a sound or reads narration credentials.
    p.intro={...p.intro,enabled:false,sound:undefined,soundPreset:'none'};
    p.outro.enabled=false;
    const logoChecks=validatePresentationMedia(p,loaded.assetRoot);
    const out=resolve(output),webp=out.slice(0,-4)+'.webp';
    const manifest=out.slice(0,-4)+'.manifest.json';
    if([out,webp,manifest].some(existsSync)) throw Error('Cover output already exists. Choose a new filename or revision directory to preserve the previous cover.');
    if(flags.has('--dry-run')) {console.log(JSON.stringify({dryRun:true,preset:p.cover.preset,out,webp,colors:coverColors(p.cover),providerCalls:0},null,2));return 0;}
    process.umask(0o077);mkdirSync(dirname(out),{recursive:true});
    if(process.platform==='win32') await privateDirectory(dirname(out));
    workspace=mkdtempSync(join(dirname(out),'.cover-render-'));
    if(process.platform==='win32') await privateDirectory(workspace);
    const presentation=installPresentation(p,loaded.assetRoot,workspace);
    const remotion=resolve(import.meta.dir,'../remotion');
    const result=spawnSync('node',[join(remotion,'node_modules/@remotion/cli/remotion-cli.js'),'still','src/projects/walkthrough-video/index.tsx','StandaloneCover',out,`--public-dir=${workspace}`,`--props=${JSON.stringify({presentation})}`,'--log=error'],{cwd:remotion,stdio:'inherit'});
    if(result.status!==0) throw Error('Cover render failed');
    const python=join(resolve(import.meta.dir,'../../..'),'.venv',process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python3');
    execFileSync(python,['-c','from PIL import Image;import sys;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=88,method=6)',out,webp]);
    writeFileSync(manifest,JSON.stringify({version:1,preset:p.cover.preset,width:1600,height:900,presentation,logoChecks,colors:coverColors(p.cover),providerCalls:0},null,2)+'\n');
    console.log(JSON.stringify({png:out,webp,preset:p.cover.preset,width:1600,height:900,providerCalls:0},null,2));
    return 0;
  } catch(error) {console.error(error instanceof Error?error.message:String(error));return 3;}
  finally {if(workspace) rmSync(workspace,{recursive:true,force:true});}
}
if(import.meta.main) process.exit(await main(process.argv.slice(2)));
