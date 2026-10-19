import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const covers = JSON.parse(await readFile(new URL("../src/covers.json", import.meta.url), "utf8"));
const briefs = JSON.parse(await readFile(new URL("../cover-library.json", import.meta.url), "utf8"));
const asset = path => new URL(`../public${path}`, import.meta.url);

test("the library preserves 32 unique originals across eight bilingual styles", async () => {
  assert.equal(covers.length, 32);
  assert.equal(briefs.covers.length, 32);
  assert.equal(new Set(covers.map(cover => cover.id)).size, 32);
  assert.equal(new Set(covers.map(cover => cover.sha256)).size, 32);
  const families = new Map();
  for (const cover of covers) {
    families.set(cover.family, (families.get(cover.family) || 0) + 1);
    assert.ok(cover.width / cover.height > 1.74 && cover.width / cover.height < 1.81, `${cover.id}: landscape slide proportions`);
    const png = await readFile(asset(cover.png));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), cover.width);
    assert.equal(png.readUInt32BE(20), cover.height);
    assert.equal(createHash("sha256").update(png).digest("hex"), cover.sha256, `${cover.id}: byte-preserved original`);
    assert.equal(png.length, cover.bytes.png);
    for (const language of ["en", "zh"]) {
      assert.ok(cover.title[language] && cover.familyTitle[language] && cover.description[language]);
    }
  }
  assert.equal(families.size, 8);
  for (const count of families.values()) assert.equal(count, 4);
});

test("all responsive WebP assets exist and stay within delivery budgets", async () => {
  let thumbnailTotal = 0;
  for (const cover of covers) {
    for (const field of ["webp", "thumbnail"]) {
      const data = await readFile(asset(cover[field]));
      assert.equal(data.subarray(0, 4).toString(), "RIFF");
      assert.equal(data.subarray(8, 12).toString(), "WEBP");
      assert.equal(data.length, cover.bytes[field]);
      assert.ok(data.length < (field === "thumbnail" ? 70_000 : 600_000), `${cover.id}: ${field} budget`);
    }
    assert.ok(cover.bytes.webp < cover.bytes.png, `${cover.id}: WebP is smaller than PNG`);
    thumbnailTotal += cover.bytes.thumbnail;
  }
  assert.ok(thumbnailTotal < 1_600_000, "the full gallery thumbnail set stays under 1.6 MB");
});
