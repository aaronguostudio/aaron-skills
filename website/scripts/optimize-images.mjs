// Regenerate committed WebP variants with cwebp 1.6.0 (libwebp).
// Original illustrations remain unchanged; no image-generation call is needed.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "public/art/optimized");
mkdirSync(output, { recursive: true });
const heroSizes =
  "(max-width: 686px) calc(100vw - 6px), (max-width: 900px) 680px, (max-width: 1199px) 640px, 850px";
const cardSizes =
  "(max-width: 509px) calc(100vw - 44px), (max-width: 900px) 465px, (max-width: 1199px) 360px, 520px";
function save(name, width, bytes) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const file = `${name}-${width}.${hash}.webp`;
  writeFileSync(path.join(output, file), bytes);
  return { width, src: `/art/optimized/${file}`, bytes: bytes.length };
}
const names = [
  "workshop-hero",
  "demo-capture",
  "walkthrough-video",
  "paste-ready-update",
  "workflow-understand",
  "workflow-build",
  "workflow-verify",
];
const artwork = {};
for (const name of names) {
  const input = path.join(root, `public/art/${name}.webp`);
  const workflow = name.startsWith("workflow-");
  const widths = workflow
    ? [192, 384]
    : name === "workshop-hero"
      ? [480, 768, 960, 1254]
      : [192, 384, 640, 960, 1254];
  const variants = widths.map((width) => {
    if (width === 1254) return save(name, width, readFileSync(input));
    const temporary = path.join(output, `${name}.tmp.webp`);
    execFileSync("cwebp", [
      "-quiet",
      "-resize",
      String(width),
      "0",
      "-q",
      "84",
      "-alpha_q",
      "95",
      "-m",
      "6",
      input,
      "-o",
      temporary,
    ]);
    const bytes = readFileSync(temporary);
    unlinkSync(temporary);
    return save(name, width, bytes);
  });
  const fallback = workflow
    ? variants.at(-1)
    : variants.find((v) => v.width === (name === "workshop-hero" ? 960 : 640));
  artwork[name] = {
    src: fallback.src,
    srcSet: variants.map((v) => `${v.src} ${v.width}w`).join(", "),
    sizes:
      name === "workshop-hero"
        ? heroSizes
        : workflow
          ? "(max-width: 900px) 160px, 200px"
          : cardSizes,
    variants,
  };
}
const temporary = path.join(output, "readme.tmp.webp");
execFileSync("cwebp", [
  "-quiet",
  "-crop",
  "0",
  "74",
  "1024",
  "574",
  "-q",
  "88",
  "-m",
  "6",
  path.join(root, "design/rendered-homepage.webp"),
  "-o",
  temporary,
]);
artwork.readme = save("readme-overview", 1024, readFileSync(temporary));
unlinkSync(temporary);
writeFileSync(
  path.join(root, "src/art.json"),
  JSON.stringify(artwork, null, 2) + "\n",
);
console.log(
  "WebP variants and source sets generated. Originals are unchanged.",
);
