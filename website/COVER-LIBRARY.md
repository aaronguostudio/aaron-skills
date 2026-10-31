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

- Byte-preserved generated PNGs: the [`cover-originals`](https://github.com/aaronguostudio/aaron-skills/releases/tag/cover-originals)
  release, mirrored locally in the ignored `website/.covers-masters/`.
- Full-size WebP: `public/covers/previews/<id>.webp`.
- Responsive 640px thumbnails: `public/covers/previews/<id>-640.webp`.
- Delivery metadata, dimensions, SHA-256 and byte sizes: `src/covers.json`.

The masters are not in the tree. Every plugin install shallow-clones this
repository, so 32 masters cost every user about 54 MB for files that only this
script and the gallery's download link read. Keeping them in a release asset
store leaves the clone near 31 MB. Their SHA-256 and byte size stay recorded in
`src/covers.json`, so integrity remains checkable. The renderer is unaffected:
Film bundles its own WebP copies under `packages/demo/covers/art/`.

`website/scripts/covers.py` maintains all of this. It needs Pillow and the
GitHub CLI; the website build needs neither.

```sh
python3 website/scripts/covers.py sync      # upload new masters, restore missing ones, rebuild derivatives
python3 website/scripts/covers.py add <file.png> --id … --family … --title-en … --title-zh … \
    --family-title-en … --family-title-zh … --description-en … --description-zh … --prompt …
python3 website/scripts/covers.py remove <id>
python3 website/scripts/covers.py verify    # report drift; --offline skips every network call
```

`sync` is idempotent and safe to run at any time. On a fresh clone it restores
every master the catalogue names, so derivatives can always be rebuilt. Commit
the previews and `src/covers.json`; the masters stay out of Git.
Keep the image samples separate from client material and capture evidence.

Run `npm run build --prefix website` and `npm run test:sites --prefix website`.
The build checks original hashes, bilingual metadata, style coverage and WebP size
budgets. Check desktop/mobile filtering, the image preview, downloads, keyboard
navigation, and language switching in a browser before publication.
