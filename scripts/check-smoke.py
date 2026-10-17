#!/usr/bin/env python3
"""Check public smoke-video scene alignment against the actual browser screenshots."""
import json
from pathlib import Path
import sys
from PIL import Image, ImageChops, ImageStat

run = Path(sys.argv[1])
steps = json.loads((run / 'steps.json').read_text())
checks = []
# The heading region excludes the pointer and outline borders in this public fixture.
# A result screen shown during the overview has a large mismatch in this region.
for index in (0, len(steps) - 1):
    step = steps[index]
    # Compare dark text shapes so the renderer's intentional pale highlight fill does
    # not count as a scene change. A wrong heading still fails this comparison.
    source = Image.open(run / step['shot']).convert('L').crop((80, 108, 680, 145)).point(lambda value: 0 if value < 110 else 255)
    rendered = Image.open(run / 'stills' / f'{index + 1:02d}-{step["id"]}.jpg').convert('L').crop((80, 108, 680, 145)).point(lambda value: 0 if value < 110 else 255)
    difference = ImageStat.Stat(ImageChops.difference(source, rendered)).mean[0] / 255
    checks.append({'step': step['id'], 'textShapeDifference': difference, 'passed': difference < 0.02})
report = {'passed': all(check['passed'] for check in checks), 'checks': checks}
(run / 'scene-alignment.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
raise SystemExit(0 if report['passed'] else 1)
