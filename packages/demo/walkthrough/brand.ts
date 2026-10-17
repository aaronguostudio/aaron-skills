// Brand profiles for walkthrough cards: read one from config/brand-profiles.json, then put the
// assets it names into the capture folder, because the composition reads every asset through
// staticFile() and the capture folder is the render's public dir.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { validateBrand, type Brand } from "../remotion/src/projects/walkthrough-video/brand/model";

// The tile's own root, so a profile's asset paths are written relative to it rather than to
// whichever folder the CLI was started from.
export const TILE = resolve(import.meta.dir, "..");
export const PROFILES = process.env.AARON_DEMO_BRAND_PROFILES || join(TILE, "config", "brand-profiles.json");
// Where a brand's assets land inside the capture folder.
export const BRAND_DIR = "brand";

export function loadBrandProfile(name: string, path = PROFILES): Brand & { id: string; assetRoot: string } {
  if (!existsSync(path)) throw new Error(`No brand profiles at ${path}`);
  const config = JSON.parse(readFileSync(path, "utf8"));
  const profile = config.profiles?.[name];
  if (!profile) {
    const known = Object.keys(config.profiles ?? {}).join(", ") || "none";
    throw new Error(`No brand profile "${name}" in ${path} (have: ${known})`);
  }
  return { ...profile, id: name, assetRoot: dirname(resolve(path)) };
}

// Copies the profile's assets into <run>/brand/ and returns the brand as the composition wants
// it, with capture-local paths. Built field by field, so a profile's bookkeeping (its id, where
// its mark came from) stays out of the render's props. Validated after the rewrite, so what is
// checked is what renders.
export function installBrand(profile: Brand & { id?: string; assetRoot?: string }, run: string): Brand {
  const brand: Brand = {
    name: profile.name,
    slogan: profile.slogan,
    primary: profile.primary,
    parts: profile.parts,
    ...(profile.viewBox ? { viewBox: profile.viewBox } : {}),
    ...(profile.aiNotice === false ? { aiNotice: false } : {}),
  };
  if (profile.sound) {
    const source = resolve(profile.assetRoot ?? TILE, profile.sound);
    if (!existsSync(source)) throw new Error(`Brand "${profile.id}" names a sound that is not there: ${source}`);
    mkdirSync(join(run, BRAND_DIR), { recursive: true });
    const name = basename(source);
    copyFileSync(source, join(run, BRAND_DIR, name));
    brand.sound = `${BRAND_DIR}/${name}`;
  }
  validateBrand(brand);
  return brand;
}
