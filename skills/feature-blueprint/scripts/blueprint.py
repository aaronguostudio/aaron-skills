#!/usr/bin/env python3
"""Validate a portable design packet and derive review views. Standard library only."""
import argparse
import html
import json
from pathlib import Path
import re
import sys


SHAPES = {
    'sources': 'id title date location authority excerpt',
    'questions': 'id round question why options recommendation status answer blocking owner next sources decisions',
    'decisions': 'id text sources',
    'rules': 'id text decisions',
    'states': 'id label',
    'transitions': 'id from to action actor rules',
    'entities': 'id fields',
    'relationships': 'from to label cardinality',
    'acceptance': 'id given when then verify rules',
    'slices': 'id title outcome acceptance dependsOn notes',
}
TOP = set('schema id title revision provenance notice outcome scope excluded limits'.split()) | set(SHAPES)
IDENTIFIER = re.compile(r'[A-Za-z][A-Za-z0-9_]*\Z')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text(value, label, *, empty=False):
    require(isinstance(value, str) and (empty or bool(value.strip())), f'{label}: expected text')


def string_list(value, label, *, empty=False):
    require(isinstance(value, list) and (empty or bool(value)), f'{label}: expected list')
    for item in value:
        text(item, label)
    require(len(value) == len(set(value)), f'{label}: duplicate entries')


def validate(data, *, ready=False):
    require(isinstance(data, dict) and set(data) == TOP, 'packet: missing or unknown fields')
    require(type(data['schema']) is int and data['schema'] == 1, 'schema: expected 1')
    for key in ('id', 'title', 'revision', 'notice', 'outcome'):
        text(data[key], key)
    require(bool(IDENTIFIER.fullmatch(data['id'])), 'packet: invalid id')
    require(data['provenance'] in ('fictional', 'project'), 'provenance: expected fictional or project')
    for key in ('scope', 'excluded', 'limits'):
        string_list(data[key], key)
    ids = {data['id']}
    groups = {}
    for group, shape in SHAPES.items():
        rows = data[group]
        require(isinstance(rows, list) and (rows or group in ('questions', 'relationships')), f'{group}: expected entries')
        groups[group] = {}
        for row in rows:
            require(isinstance(row, dict) and set(row) == set(shape.split()), f'{group}: missing or unknown fields')
            for key, value in row.items():
                label = f'{group}.{key}'
                if key in ('sources', 'decisions', 'rules', 'acceptance', 'dependsOn', 'options'):
                    string_list(value, label, empty=(key == 'dependsOn' or (group == 'questions' and key == 'decisions')))
                elif key == 'fields':
                    require(isinstance(value, list) and bool(value), f'{label}: expected fields')
                    names = set()
                    for field in value:
                        require(isinstance(field, dict) and set(field) == {'name', 'type', 'key'}, f'{label}: invalid field')
                        require(isinstance(field['name'], str) and bool(IDENTIFIER.fullmatch(field['name'])), f'{label}: invalid field name')
                        require(field['name'] not in names, f'{label}: duplicate field name')
                        names.add(field['name'])
                        require(isinstance(field['type'], str) and bool(IDENTIFIER.fullmatch(field['type'])), f'{label}: invalid field type')
                        require(field['key'] in ('', 'PK', 'FK'), f'{label}: invalid key')
                elif key == 'round':
                    require(type(value) is int and value > 0, f'{label}: expected positive integer')
                elif key == 'blocking':
                    require(type(value) is bool, f'{label}: expected Boolean')
                else:
                    text(value, label, empty=(key == 'answer' and group == 'questions' and row['status'] != 'resolved'))
            if 'id' in row:
                item_id = row['id']
                require(bool(IDENTIFIER.fullmatch(item_id)) and item_id not in ids, f'{group}: invalid or duplicate id')
                ids.add(item_id)
                groups[group][item_id] = row
    references = {
        'questions': {'sources': 'sources', 'decisions': 'decisions'},
        'decisions': {'sources': 'sources'}, 'rules': {'decisions': 'decisions'},
        'transitions': {'from': 'states', 'to': 'states', 'rules': 'rules'},
        'relationships': {'from': 'entities', 'to': 'entities'},
        'acceptance': {'rules': 'rules'},
        'slices': {'acceptance': 'acceptance', 'dependsOn': 'slices'},
    }
    for group, fields in references.items():
        for row in data[group]:
            for key, target in fields.items():
                values = row[key] if isinstance(row[key], list) else [row[key]]
                require(all(v in groups[target] for v in values), f'{group}.{key}: dangling reference')
    for question in data['questions']:
        require(question['status'] in ('open', 'resolved', 'deferred'), 'question: invalid status')
        require(len(question['options']) >= 2, 'question: at least two options required')
        if question['status'] == 'resolved':
            require(bool(question['decisions']), 'resolved question needs a decision')
        elif ready:
            require(not question['blocking'], f"{question['id']}: blocking question remains")
    for relation in data['relationships']:
        require(relation['cardinality'] in ('one-many', 'one-one'), 'relationship: invalid cardinality')
    covered_rules = {r for a in data['acceptance'] for r in a['rules']}
    require(covered_rules == set(groups['rules']), 'every rule needs acceptance coverage')
    covered_acceptance = {a for s in data['slices'] for a in s['acceptance']}
    require(covered_acceptance == set(groups['acceptance']), 'every acceptance scenario needs a slice')
    visiting, done = set(), set()

    def visit(key):
        require(key not in visiting, 'slice dependencies contain a cycle')
        if key in done:
            return
        visiting.add(key)
        for dependency in groups['slices'][key]['dependsOn']:
            visit(dependency)
        visiting.remove(key)
        done.add(key)

    for key in groups['slices']:
        visit(key)
    return data


def label(value):
    # Mermaid numeric entity escapes prevent user text from ending a label.
    return ''.join(c if c.isalnum() or c in ' .,/_-' else f'#{ord(c)};' for c in value)


def diagrams(data):
    flow = ['flowchart LR']
    flow += [f'  {s["id"]}["{label(s["label"])}"]' for s in data['states']]
    flow += [f'  {t["from"]} -->|"{label(t["actor"] + ": " + t["action"] + " [" + ", ".join(t["rules"]) + "]")}"| {t["to"]}' for t in data['transitions']]
    model = ['erDiagram']
    for entity in data['entities']:
        model.append(f'  {entity["id"]} {{')
        model += [f'    {f["type"]} {f["name"]} {f["key"]}'.rstrip() for f in entity['fields']]
        model.append('  }')
    for relation in data['relationships']:
        cardinality = '||--o{' if relation['cardinality'] == 'one-many' else '||--||'
        model.append(f'  {relation["from"]} {cardinality} {relation["to"]} : "{label(relation["label"])}"')
    return '\n'.join(flow) + '\n', '\n'.join(model) + '\n'


def md(value):
    return re.sub(r'([\\`*_\[\]#!|])', r'\\\1', html.escape(value)).replace('\n', ' ')


def handoff(data):
    flow, model = diagrams(data)
    lines = [f'# {md(data["title"])}', '', f'Revision: {md(data["revision"])} · {md(data["provenance"])}', '', md(data['notice']), '', '## Outcome', '', md(data['outcome'])]
    for key in ('scope', 'excluded', 'limits'):
        lines += ['', f'## {key.title()}', ''] + [f'- {md(v)}' for v in data[key]]
    lines += ['', '## Source ledger', '']
    for s in data['sources']:
        lines += [f'### {s["id"]} · {md(s["title"])}', '', f'{md(s["date"])} · {md(s["authority"])} · {md(s["location"])}', '', *['    ' + line for line in s['excerpt'].splitlines()], '']
    lines += ['## Clarification', '']
    for q in data['questions']:
        lines += [f'### {q["id"]} · Round {q["round"]} · {md(q["status"])}', '', md(q['question']), '', f'Why: {md(q["why"])}', '', f'Options: {" / ".join(md(v) for v in q["options"])}', '', f'Recommendation: {md(q["recommendation"])}', '', f'Answer: {md(q["answer"]) if q["answer"] else "Pending"}', '', f'Owner: {md(q["owner"])} · Next: {md(q["next"])} · Blocking: {q["blocking"]}', '', f'Evidence: {", ".join(q["sources"])} · Decisions: {", ".join(q["decisions"]) or "None"}', '']
    for key, refs in (('decisions', 'sources'), ('rules', 'decisions')):
        lines += [f'## {key.title()}', '']
        lines += [f'- **{row["id"]}** {md(row["text"])} ({", ".join(row[refs])})' for row in data[key]]
        lines.append('')
    lines += ['## Workflow', '', '```mermaid', flow.rstrip(), '```', '', '## Conceptual data model', '', '```mermaid', model.rstrip(), '```', '', '## Acceptance scenarios', '']
    for a in data['acceptance']:
        lines += [f'### {a["id"]} · {", ".join(a["rules"])}', '', f'Given {md(a["given"])}. When {md(a["when"])}. Then {md(a["then"])}.', '', f'Verify: {md(a["verify"])}', '']
    lines += ['## Implementation slices', '']
    for s in data['slices']:
        lines += [f'### {s["id"]} · {md(s["title"])}', '', md(s['outcome']), '', f'Acceptance: {", ".join(s["acceptance"])} · Depends on: {", ".join(s["dependsOn"]) or "None"}', '', md(s['notes']), '']
    return '\n'.join(lines)


def render(data, destination):
    validate(data)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    flow, model = diagrams(data)
    for name, content in {'handoff.md': handoff(data), 'workflow.mmd': flow, 'data-model.mmd': model}.items():
        (destination / name).write_text(content, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ('validate', 'render'):
        child = sub.add_parser(command)
        child.add_argument('packet', type=Path)
        if command == 'validate':
            child.add_argument('--ready', action='store_true')
        else:
            child.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    data = validate(json.loads(args.packet.read_text(encoding='utf-8')), ready=getattr(args, 'ready', False))
    if args.command == 'render':
        render(data, args.out)
    print(f'{args.command}: {data["id"]} {data["revision"]} passed (structural checks only)')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RecursionError) as error:
        sys.exit(f'blueprint: {error}')
