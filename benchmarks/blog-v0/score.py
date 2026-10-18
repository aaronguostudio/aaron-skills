#!/usr/bin/env python3
"""Validate explicit evidence-backed review decisions; never auto-judge screenshots."""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def score(rubric, review):
    expected = {item['id']: item for item in rubric['items']}
    decisions = review['items']
    if set(decisions) != set(expected):
        raise ValueError('Review must account for every rubric item exactly once')
    if set(review['gates']) != set(rubric['gates']):
        raise ValueError('Review must account for every safety gate')
    values = list(review['gates'].values())
    dimensions = {}
    pending = []
    pending_dimensions = set()
    for name, decision in decisions.items():
        if decision['pass'] is not None and type(decision['pass']) is not bool:
            raise ValueError('Use true/false/null review decisions')
        if not decision.get('evidence'):
            raise ValueError('Every decision requires evidence or an explicit missing-evidence reason')
        spec = expected[name]
        dimensions.setdefault(spec['dimension'], 0)
        if decision['pass'] is None:
            pending.append(name)
            pending_dimensions.add(spec['dimension'])
        elif decision['pass']:
            dimensions[spec['dimension']] += spec['points']
    if any(type(v) is not bool and v is not None for v in values):
        raise ValueError('Use true/false/null gate decisions')
    status = ('failed' if False in values else 'blocked' if review.get('blockedReason')
              else 'needs-review' if None in values or pending else 'reviewed')
    subtotal = sum(dimensions.values())
    return {'status': status, 'qualityScore': subtotal if status == 'reviewed' else None,
            'reviewedSubtotal': subtotal,
            'dimensions': {k: None if k in pending_dimensions else v for k, v in dimensions.items()},
            'pendingItems': pending, 'failedGates': [k for k, v in review['gates'].items() if v is False]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('review', type=Path)
    args = parser.parse_args()
    rubric = json.loads((HERE / 'rubric.json').read_text())
    print(json.dumps(score(rubric, json.loads(args.review.read_text())), indent=2))


if __name__ == '__main__':
    main()
