#!/usr/bin/env python3
"""Inspect saved evidence geometry and resolve presentation edits without an app browser."""
import argparse
import json
import math
from pathlib import Path


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def box(value, viewport):
    if isinstance(value, list) and len(value) == 4:
        value = dict(zip(('x', 'y', 'w', 'h'), value))
    if not isinstance(value, dict) or set(value) != {'x', 'y', 'w', 'h'} or not all(finite(n) for n in value.values()):
        raise ValueError('Target box needs finite x,y,w,h')
    x, y, w, h = (value[k] for k in ('x', 'y', 'w', 'h'))
    if not (x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= viewport['w'] and y + h <= viewport['h']):
        raise ValueError('Target box must fit inside the capture viewport')
    return value


def validate_masks(capture, steps):
    if 'masks' not in capture:
        return
    masks = capture['masks']
    if not isinstance(masks, list):
        raise ValueError('Masks must be an array; [] removes masking')
    for mask in masks:
        if not isinstance(mask, dict) or set(mask) != {'box', 'fromMs', 'toMs'}:
            raise ValueError('Mask needs only box, fromMs and toMs')
        box(mask['box'], capture['viewport'])
        a, b = mask['fromMs'], mask['toMs']
        if not (finite(a) and finite(b) and steps[0]['startMs'] <= a <= b <= steps[-1]['endMs']):
            raise ValueError('Mask times must fit inside the recorded step range')


def target_focus(step, names, viewport):
    targets = step.get('targets', {})
    if not isinstance(names, list) or not names or not all(isinstance(n, str) for n in names) or len(set(names)) != len(names):
        raise ValueError('focusTargets needs a nonempty list of unique saved target names')
    if not isinstance(targets, dict) or set(names) - set(targets):
        raise ValueError('Unknown saved focus target; inspect the capture for available names')
    required = set(step.get('evidence', {}))
    if required - set(names):
        raise ValueError('Highlight omits checked evidence targets: ' + ', '.join(sorted(required - set(names))))
    rectangles, starts, ends = [], [], []
    for name in names:
        target = targets[name]
        if not isinstance(target, dict) or set(target) != {'boxes', 'fromMs', 'toMs'} or not isinstance(target['boxes'], list) or not target['boxes']:
            raise ValueError('Saved target needs boxes and its capture-clock interval')
        a, b = target['fromMs'], target['toMs']
        if not (finite(a) and finite(b) and step['startMs'] <= a <= b <= step['endMs']):
            raise ValueError('Saved target times must fit inside the original step')
        rectangles.extend(box(value, viewport) for value in target['boxes'])
        starts.append(a); ends.append(b)
    if max(starts) > min(ends):
        raise ValueError('Saved targets were not measured on the same screen interval')
    x, y = min(b['x'] for b in rectangles), min(b['y'] for b in rectangles)
    return [{'box': {'x': x, 'y': y, 'w': max(b['x'] + b['w'] for b in rectangles) - x,
                     'h': max(b['y'] + b['h'] for b in rectangles) - y},
             'fromMs': max(starts), 'toMs': min(ends)}]


def validate_coverage(step, viewport):
    evidence = step.get('evidence')
    if evidence is None:
        return None  # Legacy captures remain readable; do not invent verification receipts.
    if not isinstance(evidence, dict) or not evidence:
        raise ValueError('Evidence declaration must be a nonempty object')
    for receipt in evidence.values():
        if not isinstance(receipt, dict) or set(receipt) != {'kind', 'expected'} or receipt['kind'] not in {'text', 'integer', 'dollarMinor', 'count'}:
            raise ValueError('Invalid saved evidence receipt')
        expected = receipt['expected']
        if (receipt['kind'] == 'text' and not isinstance(expected, str)) or (receipt['kind'] != 'text' and
                (type(expected) is not int or not 0 <= expected <= 9007199254740991)):
            raise ValueError('Invalid saved evidence expected value')
    target_focus(step, list(evidence), viewport)  # validate names/geometry/intervals
    focus = step.get('focus', [])
    if not isinstance(focus, list):
        raise ValueError('Evidence focus must be a list')
    for f in focus:
        if not isinstance(f, dict) or set(f) != {'box', 'fromMs', 'toMs'}:
            raise ValueError('Evidence focus needs box and its capture-clock interval')
        if not (finite(f['fromMs']) and finite(f['toMs']) and step['startMs'] <= f['fromMs'] <= f['toMs'] <= step['endMs']):
            raise ValueError('Evidence focus times must fit inside the step')
        box(f['box'], viewport)
    for name in evidence:
        target = step['targets'][name]
        for value in target['boxes']:
            r = box(value, viewport)
            def covers(f):
                b = box(f['box'], viewport)
                return (f['fromMs'] <= target['fromMs'] and f['toMs'] >= target['toMs']
                        and b['x'] <= r['x'] + 1e-6 and b['y'] <= r['y'] + 1e-6
                        and b['x'] + b['w'] + 1e-6 >= r['x'] + r['w']
                        and b['y'] + b['h'] + 1e-6 >= r['y'] + r['h'])
            if not any(covers(f) for f in focus):
                raise ValueError(f"Step {step['id']} highlight omits checked evidence target {name}; revise focus from saved targets, no recapture needed")
    return True


def inspect_capture(source, *, strict=False):
    source = Path(source).resolve()
    capture = json.loads((source / 'capture.json').read_text(encoding='utf-8'))
    steps = json.loads((source / 'steps.json').read_text(encoding='utf-8'))
    if capture.get('version') != 1 or capture.get('status') != 'passed':
        raise ValueError('Only a passed contract-1 capture is ready for presentation review')
    viewport = capture.get('viewport', {})
    if not all(finite(viewport.get(k)) and viewport[k] > 0 for k in ('w', 'h')):
        raise ValueError('Invalid capture viewport')
    if not isinstance(steps, list) or not steps:
        raise ValueError('Capture needs steps')
    validate_masks(capture, steps)
    reviewed, issues = [], []
    for step in steps:
        item = {k: step.get(k) for k in ('id', 'caption', 'kind', 'startMs', 'endMs', 'focus', 'targets', 'evidence')}
        try:
            item['evidenceFocusComplete'] = validate_coverage(step, viewport)
        except (ValueError, KeyError, TypeError) as error:
            if strict:
                raise ValueError(str(error)) from error
            item.update(evidenceFocusComplete=False, issue=str(error))
            issues.append(str(error))
        reviewed.append(item)
    return {'source': str(source), 'status': capture['status'], 'viewport': viewport, 'masks': capture.get('masks', []), 'readyToRender': not issues,
            'presentationEdits': 'For unchanged UI/actions, revise this capture, including first-pass visual fixes; do not replay the business flow.',
            'issues': issues, 'steps': reviewed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(inspect_capture(args.source), indent=2, ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, f'aaron-demo inspect: {error}\n')


if __name__ == '__main__':
    main()
