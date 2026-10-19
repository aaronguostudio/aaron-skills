import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { BRAND_DIR, installBrand, loadBrandProfile, PROFILES } from "./brand";
import { validateBrand, type Brand } from "../remotion/src/projects/walkthrough-video/brand/model";

const brand = (overrides: Partial<Brand> = {}): Brand => ({
  name: "Demo App",
  slogan: "Show what changed.",
  primary: "#0a1f28",
  parts: [{ kind: "ellipse", cx: 10, cy: 10, rx: 5, ry: 5 }],
  ...overrides,
});

const profiles = (value: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), "brand-test-"));
  const path = join(dir, "brand-profiles.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
};

describe("validateBrand", () => {
  test("accepts a mark built from the primitives a real SVG uses", () => {
    expect(() => validateBrand(brand({ parts: [{ kind: "polygon", points: "0,0 1,1 2,0" }, { kind: "path", d: "M0 0 L1 1" }] }))).not.toThrow();
  });

  test("a line too long to read on a card is refused", () => {
    expect(() => validateBrand(brand({ slogan: "x".repeat(73) }))).toThrow(/at most 72/);
  });

  test("a primitive the card cannot draw is refused", () => {
    expect(() => validateBrand(brand({ parts: [{ kind: "spline" } as never] }))).toThrow(/cannot be drawn/);
  });

  test("a part without its geometry is refused", () => {
    expect(() => validateBrand(brand({ parts: [{ kind: "polygon" }] }))).toThrow(/needs its points/);
    expect(() => validateBrand(brand({ parts: [{ kind: "path" }] }))).toThrow(/needs its d/);
  });

  test("a sound outside the capture folder is refused, because the capture folder is the public dir", () => {
    expect(() => validateBrand(brand({ sound: "/etc/ding.wav" }))).toThrow(/capture-local/);
    expect(() => validateBrand(brand({ sound: "../ding.wav" }))).toThrow(/capture-local/);
  });
});

describe("loadBrandProfile", () => {
  test("names the profiles it does have when asked for one it does not", () => {
    expect(() => loadBrandProfile("nope", profiles({ profiles: { demo: brand() } }))).toThrow(/have: demo/);
  });

  test("the shipped demo profile is valid and keeps the app's own mark and slate", () => {
    const profile = loadBrandProfile("demo");
    expect(() => validateBrand(profile)).not.toThrow();
    expect(profile.primary).toBe("#172033");
    expect(profile.parts).toHaveLength(1);
    expect(profile.sound).toBeUndefined();
  });
});

describe("installBrand", () => {
  test("copies a user-owned sound into the capture folder", () => {
    const run = mkdtempSync(join(tmpdir(), "brand-run-"));
    const path = profiles({ profiles: { demo: brand({ sound: "sting.wav" }) } });
    writeFileSync(join(require("path").dirname(path), "sting.wav"), "fixture audio");
    const installed = installBrand(loadBrandProfile("demo", path), run);
    expect(installed.sound).toStartWith(`${BRAND_DIR}/`);
    expect(existsSync(join(run, installed.sound!))).toBe(true);
  });

  test("a profile's bookkeeping stays out of the render's props", () => {
    const run = mkdtempSync(join(tmpdir(), "brand-run-"));
    const installed = installBrand(loadBrandProfile("demo"), run) as Record<string, unknown>;
    expect(installed.id).toBeUndefined();
    expect(installed.source).toBeUndefined();
    expect(installed.assetRoot).toBeUndefined();
  });

  test("a sound the profile names but does not have is refused before anything is rendered", () => {
    const run = mkdtempSync(join(tmpdir(), "brand-run-"));
    const path = profiles({ profiles: { ghost: brand({ sound: "assets/brand/not-here.wav" }) } });
    expect(() => installBrand(loadBrandProfile("ghost", path), run)).toThrow(/not there/);
  });
});

describe("the profiles the tile ships", () => {
  test("every one of them renders", () => {
    const config = JSON.parse(require("fs").readFileSync(PROFILES, "utf8"));
    for (const [id, profile] of Object.entries(config.profiles)) {
      expect(() => validateBrand(profile), `profile ${id}`).not.toThrow();
    }
  });
});

 test("brand notice opt-in survives installation without enabling omitted notices", () => {
  const dir = mkdtempSync(join(tmpdir(), "notice-brand-"));
  expect(installBrand(brand(), dir).aiNotice).toBeUndefined();
  expect(installBrand(brand({aiNotice:true}), dir).aiNotice).toBe(true);
  expect(installBrand(brand({aiNotice:false}), dir).aiNotice).toBe(false);
  expect(() => validateBrand(brand({aiNotice:"true" as never}))).toThrow(/boolean/);
});
