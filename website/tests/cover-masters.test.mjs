// Network gate, separate from the offline suite: downloads every byte-preserved
// PNG master from the cover-originals release and checks it against covers.json.
// Run it with `npm run test:cover-masters`; `npm run verify` stays offline.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { MASTER_STORE } from "./covers.test.mjs";

const covers = JSON.parse(await readFile(new URL("../src/covers.json", import.meta.url), "utf8"));

test("every master in the release matches the recorded digest, size and dimensions", async () => {
  for (const cover of covers) {
    const response = await fetch(`${MASTER_STORE}${cover.id}.png`, { redirect: "follow" });
    assert.equal(response.status, 200, `${cover.id}: master is reachable`);
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), "PNG", `${cover.id}: PNG signature`);
    assert.equal(png.readUInt32BE(16), cover.width, `${cover.id}: recorded width`);
    assert.equal(png.readUInt32BE(20), cover.height, `${cover.id}: recorded height`);
    assert.equal(png.length, cover.bytes.png, `${cover.id}: recorded size`);
    assert.equal(createHash("sha256").update(png).digest("hex"), cover.sha256, `${cover.id}: byte-preserved original`);
  }
});
