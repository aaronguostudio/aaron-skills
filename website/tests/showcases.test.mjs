import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cases = JSON.parse(await readFile(new URL("../src/showcases.json", import.meta.url), "utf8"));

test("every published recipe has a short playable export and accessible delivery assets", () => {
  assert.equal(cases.length, 2);
  assert.deepEqual(cases.map(item => item.kind).sort(), ["public", "synthetic"]);
  const uniqueVideos = new Set();
  const expected = { ledgerlane: ["official-demo", "quick-demo", "release-update", "stakeholder-walkthrough", "task-tutorial", "training-lesson"], blog: ["blog-tutorial", "blog-story"] };
  for (const item of cases) {
    assert.deepEqual(item.variants.map(cut => cut.id), expected[item.id]);
    for (const cut of item.variants) {
      assert.ok(cut.seconds >= 30 && cut.seconds <= 60, `${item.id}/${cut.id}: duration must be 30–60s`);
      assert.ok(cut.bytes > 0 && cut.bytes < 15_000_000, "short clips must keep a modest delivery size");
      assert.match(cut.sha256, /^[0-9a-f]{64}$/);
      for (const [field, extension] of [["video", ".mp4"], ["poster", ".webp"], ["captions", ".vtt"]]) {
        const url = new URL(cut[field]);
        assert.equal(url.protocol, "https:");
        assert.equal(url.hostname, "yhghjbt7biptwjsj.public.blob.vercel-storage.com");
        assert.ok(url.pathname.endsWith(extension));
        assert.equal(url.search, "", "delivery URLs must not carry credentials or signed query parameters");
      }
      assert.ok(!uniqueVideos.has(cut.video), "each recipe must link its own actual render");
      uniqueVideos.add(cut.video);
      for (const lang of ["en", "zh"]) {
        assert.ok(item.title[lang] && item.summary[lang] && cut.purpose[lang] && cut.brief[lang]);
        assert.ok(!/pending|待确认/i.test(cut.audio[lang]), "resolve the audio choice before publication");
      }
    }
  }
});


test("the welcome publishes only reviewed delivery metadata", async () => {
  const intro = JSON.parse(await readFile(new URL("../src/introduction.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(intro).sort(), ["bytes", "captions", "poster", "seconds", "sha256", "video"]);
  assert.ok(intro.seconds > 30 && intro.seconds < 60);
  assert.ok(intro.bytes > 0 && intro.bytes < 15_000_000);
  assert.match(intro.sha256, /^[0-9a-f]{64}$/);
  for (const field of ["video", "captions", "poster"]) {
    const url = new URL(intro[field]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "yhghjbt7biptwjsj.public.blob.vercel-storage.com");
    assert.equal(url.search + url.username + url.password, "");
  }
});
