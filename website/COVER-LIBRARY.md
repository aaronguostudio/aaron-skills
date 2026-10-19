# Presentation cover library

The bilingual `/covers` gallery presents 32 presentation-cover images across eight
visual directions. Each uses a strong title, a single image or color block, and
small brand, subtitle, presenter and date details. The imagery was generated with
OpenAI's built-in image generation; the generation briefs are in `cover-library.json`.
The four initial approved examples are included alongside 28 new designs.

These are raster image samples with illustrative text. The gallery does not add
editable slide templates or new Film runtime presets. Original PNG downloads and
full-size WebP downloads are available from each preview. Opening a preview supports
keyboard navigation, Escape, and native dialog focus restoration.

## Assets

- Byte-preserved generated PNGs: `public/covers/originals/<id>.png`.
- Full-size WebP: `public/covers/previews/<id>.webp`.
- Responsive 640px thumbnails: `public/covers/previews/<id>-640.webp`.
- Delivery metadata, dimensions, SHA-256 and byte sizes: `src/covers.json`.

To rebuild the WebP derivatives, install Pillow and run
`python3 website/scripts/prepare-cover-assets.py` from the repository root. This
leaves the PNG originals unchanged. The website build does not require Pillow.
Keep the image samples separate from client material and capture evidence.

Run `npm run build --prefix website` and `npm run test:sites --prefix website`.
The build checks original hashes, bilingual metadata, style coverage and WebP size
budgets. Check desktop/mobile filtering, the image preview, downloads, keyboard
navigation, and language switching in a browser before publication.
