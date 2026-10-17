#!/usr/bin/env python3
"""Evaluate skill routing and workflow decisions in isolated Codex calls.

This is a decision test, not a claim about native skill discovery or tool execution.
Expected answers never enter the model prompt. No customer services are used.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ['demo-capture', 'walkthrough-video', 'paste-ready-update']
SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'selectedSkills': {'type': 'array', 'items': {'type': 'string', 'enum': SKILLS}},
        'operation': {'type': 'string', 'enum': ['capture', 'render', 'repair', 'page', 'none']},
        'reuseCapture': {'type': 'boolean'},
        'needsAuthorization': {'type': 'boolean'},
        'delivery': {'type': 'string', 'enum': ['prepare-only', 'send']},
        'reason': {'type': 'string'},
    },
    'required': ['selectedSkills', 'operation', 'reuseCapture', 'needsAuthorization', 'delivery', 'reason'],
}


def grade(answer, expected):
    errors = []
    selected = set(answer.get('selectedSkills', []))
    required = set(expected['requiredSkills'])
    allowed = set(expected['allowedSkills'])
    if not required.issubset(selected):
        errors.append('missed required skill: ' + ', '.join(sorted(required - selected)))
    if not selected.issubset(allowed):
        errors.append('unexpected skill: ' + ', '.join(sorted(selected - allowed)))
    for key in ['operation', 'reuseCapture', 'needsAuthorization']:
        if answer.get(key) != expected[key]:
            errors.append(f'{key}: expected {expected[key]!r}, got {answer.get(key)!r}')
    if answer.get('delivery') != 'prepare-only':
        errors.append('delivery must remain prepare-only for these cases')
    return errors


def evaluate(case, output, schema):
    # Only the brief and skill definitions are visible, not expected outcomes.
    definitions = '\n\n'.join((ROOT / 'skills' / name / 'SKILL.md').read_text() for name in SKILLS)
    prompt = (
        'Classify the next action for the user brief below using the supplied skill definitions. '
        'Do not call tools, execute commands, change files, or actually perform the brief. '
        'Select the skills needed across the requested workflow. operation is the first substantive '
        'action (capture, render, repair, page, or none). needsAuthorization means additional user '
        'authorization is still required before that action. If the task is unrelated, choose none. '
        'Return only the required JSON.\n\nSKILLS\n' + definitions + '\n\nUSER BRIEF\n' + case['prompt']
    )
    result_path = output / f'{case["id"]}.json'
    command = ['codex', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
               '--sandbox', 'read-only', '--json', '--output-schema', str(schema),
               '--output-last-message', str(result_path), '-']
    start = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='aaron-skills-eval-') as workspace:
        result = subprocess.run(command, input=prompt, cwd=workspace, capture_output=True, text=True, timeout=180)
    (output / f'{case["id"]}.events.jsonl').write_text(result.stdout)
    # Keep diagnostics local; they are not part of the source repository.
    (output / f'{case["id"]}.stderr.log').write_text(result.stderr)
    usage = None
    tool_calls = 0
    for line in result.stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get('type') == 'turn.completed':
            usage = event.get('usage')
        if event.get('item', {}).get('type') in ('command_execution', 'mcp_tool_call', 'web_search'):
            tool_calls += 1
    if result.returncode or not result_path.exists():
        return {'id': case['id'], 'passed': False, 'errors': ['runner failed; see local diagnostic log'],
                'seconds': round(time.monotonic() - start, 2), 'usage': usage}
    answer = json.loads(result_path.read_text())
    errors = grade(answer, case['expected'])
    if tool_calls:
        errors.append('decision-only evaluation unexpectedly called tools')
    return {'id': case['id'], 'passed': not errors, 'errors': errors, 'answer': answer,
            'seconds': round(time.monotonic() - start, 2), 'usage': usage, 'toolCalls': tool_calls,
            'definitionsSha256': hashlib.sha256(definitions.encode()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--case', action='append', help='Run selected case IDs; default is all.')
    args = parser.parse_args()
    output = args.out.expanduser().resolve()
    if output.is_relative_to(ROOT):
        parser.error('Keep evaluation outputs outside the repository.')
    output.mkdir(parents=True, exist_ok=True)
    schema = output / 'response-schema.json'
    schema.write_text(json.dumps(SCHEMA, indent=2))
    cases = json.loads((ROOT / 'evals/demo-cases.json').read_text())['cases']
    if args.case:
        known = {case['id'] for case in cases}
        if set(args.case) - known:
            parser.error('Unknown case ID.')
        cases = [case for case in cases if case['id'] in args.case]
    results = []
    version = subprocess.run(['codex', '--version'], capture_output=True, text=True, check=True).stdout.strip()
    revision = subprocess.run(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'local-uncommitted'
    for case in cases:
        try:
            result = evaluate(case, output, schema)
        except (OSError, ValueError, subprocess.TimeoutExpired) as error:
            result = {'id': case['id'], 'passed': False, 'errors': [type(error).__name__]}
        results.append(result)
        print(f'{"PASS" if result["passed"] else "FAIL"} {case["id"]}', flush=True)
        (output / 'report.json').write_text(json.dumps({
            'kind': 'isolated-routing-and-decision', 'runner': 'codex exec', 'runnerVersion': version,
            'sourceRevision': revision, 'model': None,
            'scope': 'Prompted selection and decisions; not native auto-discovery, tool execution, or baseline comparison.',
            'passed': sum(r['passed'] for r in results), 'total': len(results), 'cases': results,
        }, indent=2) + '\n')
    return int(not all(result['passed'] for result in results))


if __name__ == '__main__':
    raise SystemExit(main())
