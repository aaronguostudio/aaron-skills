"""Check synthetic mask pixels, separating lossless coverage from codec edge ringing."""
import argparse
import base64
import io
import json
import math
from pathlib import Path
import re
from PIL import Image, ImageChops

COLOR = (17, 24, 39)


def check_mask(image, box, *, lossless, name='image'):
    image = image.convert('RGB')
    x, y, w, h = box
    # The compositor rounds outwards. PNG verifies the complete rectangle,
    # including all four edges. H.264/JPEG can ring near a high-contrast edge;
    # verify its interior independently rather than pretending it is lossless.
    inset = 0 if lossless else 8
    bounds = (math.floor(x) + inset, math.floor(y) + inset,
              math.ceil(x + w) - inset, math.ceil(y + h) - inset)
    if not (0 <= bounds[0] < bounds[2] <= image.width and 0 <= bounds[1] < bounds[3] <= image.height):
        raise ValueError(f'{name}: no valid mask sample area')
    sample = image.crop(bounds)
    delta = ImageChops.difference(sample, Image.new('RGB', sample.size, COLOR))
    maximum = max(high for low, high in delta.getextrema())
    limit = 1 if lossless else 10
    if maximum > limit:
        raise ValueError(f'{name}: mask pixel mismatch; region={bounds}, maximum channel delta={maximum}, limit={limit}')
    return {'image': name, 'lossless': lossless, 'region': bounds, 'maxChannelDelta': maximum}


def verify(root):
    root = Path(root)
    box = json.loads((root / 'capture.json').read_text(encoding='utf-8'))['masks'][0]['box']
    checks = [check_mask(Image.open(root / 'body-preview.png'), box, lossless=True, name='body-preview.png')]
    stills = sorted((root / 'stills').glob('*.jpg'))
    if not stills:
        raise ValueError('No rendered MP4 stills to check')
    checks.extend(check_mask(Image.open(p), box, lossless=False, name=p.name) for p in stills)
    embedded = re.search(r'data:image/[^;]+;base64,([^"\s]+)', (root / 'message.html').read_text(encoding='utf-8'))
    if not embedded:
        raise ValueError('Masked Share page must embed a rendered still')
    checks.append(check_mask(Image.open(io.BytesIO(base64.b64decode(embedded[1]))), box,
                             lossless=False, name='embedded Share image'))
    return {'passed': True, 'checks': checks}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    args = parser.parse_args()
    result = verify(args.root)
    (args.root / 'mask-pixels.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('MASK PIXELS PASSED: lossless full coverage, MP4 interiors and embedded Share image')
