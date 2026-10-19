// Read-only delivery probe. Run separately from deterministic/offline build checks.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const cases = JSON.parse(await readFile(new URL("../src/showcases.json", import.meta.url), "utf8"));
const introduction = JSON.parse(await readFile(new URL("../src/introduction.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
let caseId, variantId;
for (let i = 0; i < args.length; i += 2) {
  assert.ok(["--case", "--variant"].includes(args[i]) && args[i + 1], "Use --case <id> and/or --variant <id>, or no arguments for the complete release.");
  if (args[i] === "--case") caseId = args[i + 1];
  else variantId = args[i + 1];
}
const selected = cases.flatMap(item => item.variants.map(cut => ({ item, cut })))
  .filter(({ item, cut }) => (!caseId || caseId === item.id) && (!variantId || variantId === cut.id));
assert.ok(selected.length, "No matching showcase recipe.");
if (!caseId && !variantId) selected.push({ item: { id: "aaron-skills" }, cut: { id: "introduction", ...introduction } });

function checkUrl(value, extension) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "yhghjbt7biptwjsj.public.blob.vercel-storage.com");
  assert.equal(url.username + url.password + url.search + url.hash, "", "Public delivery URLs must contain no credentials or query parameters.");
  assert.ok(url.pathname.endsWith(extension));
  return url.href;
}

function checkFastStart(bytes) {
  let position = 0, moov = -1, mdat = -1;
  while (position + 8 <= bytes.length) {
    let size = bytes.readUInt32BE(position), header = 8;
    const type = bytes.toString("ascii", position + 4, position + 8);
    if (size === 1) {
      assert.ok(position + 16 <= bytes.length, "Truncated MP4 atom.");
      size = Number(bytes.readBigUInt64BE(position + 8)); header = 16;
    } else if (size === 0) size = bytes.length - position;
    assert.ok(Number.isSafeInteger(size) && size >= header && position + size <= bytes.length, "Invalid MP4 atom.");
    if (type === "moov") moov = position;
    if (type === "mdat" && mdat < 0) mdat = position;
    position += size;
  }
  assert.equal(position, bytes.length, "Truncated MP4 container.");
  assert.ok(moov >= 0 && mdat >= 0 && moov < mdat, "Movie metadata must precede media for fast-start playback.");
}

const origin = "https://skills.aaronguo.com";
for (const { item, cut } of selected) {
  const label = `${item.id}/${cut.id}`;
  assert.ok(cut.seconds >= 30 && cut.seconds <= 60, `${label}: missing or invalid duration`);
  for (const [field, extension, mime, limit] of [
    ["video", ".mp4", "video/mp4", 15_000_000],
    ["poster", ".webp", "image/webp", 150_000],
    ["captions", ".vtt", "text/vtt", 50_000],
  ]) {
    const url = checkUrl(cut[field], extension);
    const response = await fetch(url, { headers: { Origin: origin }, signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, `${label}/${field}: HTTP error`);
    assert.ok(response.headers.get("content-type")?.startsWith(mime), `${label}/${field}: wrong MIME type`);
    assert.ok(["*", origin].includes(response.headers.get("access-control-allow-origin")), `${label}/${field}: CORS disallows the website`);
    assert.ok(Number(response.headers.get("content-length")) <= limit, `${label}/${field}: oversized asset`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 0 && bytes.length <= limit, `${label}/${field}: invalid delivered size`);
    if (field === "video") {
      assert.equal(bytes.length, cut.bytes, `${label}: delivered video size changed`);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), cut.sha256, `${label}: delivered video differs from reviewed export`);
      checkFastStart(bytes);
      const range = await fetch(url, { headers: { Origin: origin, Range: "bytes=0-1023" }, signal: AbortSignal.timeout(30_000) });
      assert.equal(range.status, 206, `${label}: seeking requires range support`);
      assert.equal(range.headers.get("content-range"), `bytes 0-1023/${bytes.length}`);
      assert.equal((await range.arrayBuffer()).byteLength, 1024);
    } else if (field === "poster") {
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    } else {
      const text = bytes.toString("utf8");
      assert.ok(text.startsWith("WEBVTT\n") && text.includes(" --> "), `${label}: missing caption cues`);
      const times = [...text.matchAll(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/g)];
      assert.ok(times.length, `${label}: malformed caption timestamps`);
      let previousEnd = 0;
      for (const match of times) {
        const values = match.slice(1).map(Number);
        const start = values[0] * 3600 + values[1] * 60 + values[2] + values[3] / 1000;
        const end = values[4] * 3600 + values[5] * 60 + values[6] + values[7] / 1000;
        assert.ok(start >= previousEnd && end > start && end <= cut.seconds + 0.1, `${label}: captions overlap or exceed the movie`);
        previousEnd = end;
      }
    }
    console.log(`${label}/${field}: verified ${bytes.length} bytes`);
  }
}
console.log(`Verified ${selected.length} recipe(s)${caseId || variantId ? " (explicit subset; not full release acceptance)" : " (complete media set)"}. Browser playback review is still required.`);
