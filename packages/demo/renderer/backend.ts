// Stable entry point for CLI callers and future harness adapters.
import {mkdirSync, mkdtempSync, renameSync, rmSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {privateDirectory} from '../capture/scripts/platform.mjs';
import {composition} from './composition';
import {hyperframesBackend} from './backends/hyperframes';
import type {RenderBackend, RenderRequest, RenderResult} from './contract';

export type {RenderRequest, RenderBackend, RenderResult} from './contract';

export function createRenderer(backend:RenderBackend) {
  return async (request:RenderRequest):Promise<RenderResult> => {
    // Check evidence before starting any backend or touching the destination.
    const scene=composition(request);
    const out=resolve(request.out);
    mkdirSync(dirname(out),{recursive:true});
    // A failed render must not replace the user's last successful artifact.
    // Use the same filesystem as the destination for the final atomic rename.
    const staging=mkdtempSync(join(dirname(out),'.aaron-film-'));
    try {
      if(process.platform==='win32')await privateDirectory(staging);
      const pending=join(staging,basename(out));
      await backend.render({...request,out:pending},scene);
      renameSync(pending,out);
      return {renderer:backend.info,...scene.config};
    } finally {
      rmSync(staging,{recursive:true,force:true});
    }
  };
}

export const RENDERER=hyperframesBackend.info;
export const render=createRenderer(hyperframesBackend);
