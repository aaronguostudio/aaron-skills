# Website image delivery

Measured 2026-10-17. The accepted artwork and layout are preserved.

## What changed

- All seven original illustrations were already WebP (1,175,102 bytes total).
  They remain untouched for high-density displays and as editable source inputs.
- Committed, content-hashed WebP variants now serve each display size through
  `srcset` and `sizes`. Workflow thumbnails use only 192/384-pixel variants.
- Responsive hero preload is emitted in HTML, before React runs. Its source set
  matches the actual hero image, avoiding an extra fallback download.
- Non-hero illustrations retain native lazy loading and async decoding. A closed
  detail dialog no longer creates an invisible image request.
- The exact existing Latin variable font is retained and preloaded (48,256 bytes).
  Unused font subsets are omitted from the build; they were not all downloaded
  by browsers previously. Chinese continues to use the system font.
- Vercel gives fingerprinted images, scripts and styles a one-year immutable
  browser cache. `release.json` uses no-store; stable original image paths do not
  receive immutable caching.

## Measured image bytes

| Resource | Before | Current | Difference |
| --- | ---: | ---: | ---: |
| Hero, 390 CSS px / DPR 1, fresh source | 312,984 | 63,478 (480 px) | −79.7% |
| Hero, 390 CSS px / DPR 2 candidate | 312,984 | 129,196 (768 px) | −58.7% |
| Five workflow images, 192 px variants | 612,008 | 34,448 | −94.4% |
| Five workflow images, 384 px variants | 612,008 | 91,540 | −85.0% |
| Four README images combined | — | 145,540 | New, shared website assets |

The DPR 1 selection was observed in Chrome on the production build at 390 × 844;
DPR 2 is the source-set candidate calculated from the same declared sizes. A
browser may reuse a larger already-cached image. Byte reductions are resource
measurements, not a promised loading time or a Lighthouse/Core Web Vitals score.
Real-user timings depend on the network, browser and device.

## Verification

- All variants decode as RGBA WebP with their declared dimensions and alpha.
- Chrome desktop and fresh-origin phone rendering preserve typography, layout,
  copper/ceramic detail and transparent edges. Phone has no horizontal overflow.
- Hero selected the 480 px file in the fresh DPR 1 phone run. Images below the
  browser's lazy-load threshold remained unloaded until navigation/scrolling.
- English/Chinese switching, skill dialog, Escape and restored scrolling pass.
- Production build and four hosting-adapter checks pass; browser warning/error
  log is empty. Header behavior is verified against the Vercel deployment.
- Evidence: `.artifacts/performance-comparison.jpg`, `performance-phone-built.png`.

## Regeneration

Run `node website/scripts/optimize-images.mjs` with cwebp 1.6.0 available to rebuild
variants from the seven original WebPs and the accepted rendered homepage. This
is an optional authoring command, not a build or runtime dependency. Files and
`src/art.json` are committed together; changed bytes produce a new cache key.
Keep published variants while external README links still reference them.
