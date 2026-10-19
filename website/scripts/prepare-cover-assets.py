#!/usr/bin/env python3
"""Build responsive WebP cover previews from byte-preserved original PNGs.

Install Pillow, then run this script from any working directory. Original files
live in public/covers/originals/<id>.png. Generation briefs are in cover-library.json.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'cover-library.json').read_text())
previews = ROOT / 'public/covers/previews'
previews.mkdir(parents=True, exist_ok=True)
output = []
for entry in catalog['covers']:
    original = ROOT / 'public/covers/originals' / (entry['id'] + '.png')
    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    with Image.open(original) as image:
        image = image.convert('RGB')
        width, height = image.size
        for size, suffix, quality in [(width, '', 88), (640, '-640', 82)]:
            preview = image.copy()
            if size < width:
                preview.thumbnail((size, round(size * height / width)), Image.Resampling.LANCZOS)
            preview.save(previews / (entry['id'] + suffix + '.webp'), 'WEBP', quality=quality, method=6)
    base = '/covers/previews/' + entry['id']
    full = previews / (entry['id'] + '.webp')
    thumb = previews / (entry['id'] + '-640.webp')
    output.append({**{key: entry[key] for key in ['id', 'title', 'family', 'familyTitle', 'description']},
                   'width': width, 'height': height, 'png': '/covers/originals/' + original.name,
                   'webp': base + '.webp', 'thumbnail': base + '-640.webp', 'sha256': digest,
                   'bytes': {'png': original.stat().st_size, 'webp': full.stat().st_size, 'thumbnail': thumb.stat().st_size}})
(ROOT / 'src/covers.json').write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
print('Prepared', len(output), 'covers; original PNG files left unchanged.')
