import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const artwork = JSON.parse(
  readFileSync(new URL("./src/art.json", import.meta.url)),
);

if (
  process.env.VERCEL_ENV === "production" &&
  (process.env.VERCEL_GIT_COMMIT_REF !== "main" ||
    !/^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA || ""))
) {
  throw new Error("Production builds require a committed main Git revision.");
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [
    react(),
    {
      name: "preload-hero",
      transformIndexHtml() {
        const hero = artwork["workshop-hero"];
        return [
          {
            tag: "link",
            attrs: {
              rel: "preload",
              as: "image",
              type: "image/webp",
              href: hero.src,
              imagesrcset: hero.srcSet,
              imagesizes: hero.sizes,
              fetchpriority: "high",
            },
            injectTo: "head",
          },
        ];
      },
    },
    {
      name: "release-metadata",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "release.json",
          source: JSON.stringify({
            commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
            branch: process.env.VERCEL_GIT_COMMIT_REF || null,
          }),
        });
      },
    },
  ],
});
