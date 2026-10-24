"""Keep deterministic, native-agent and human evidence separate."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def grade(report):
    expected = json.loads((HERE / 'case.json').read_text(encoding='utf-8'))['requiredStages']
    stages = report.get('stages', [])
    names = [stage.get('id') for stage in stages]
    errors = []
    if len(names) != len(set(names)):
        errors.append('duplicate stage results')
    for name in expected:
        if not any(stage.get('id') == name and stage.get('status') == 'passed' for stage in stages):
            errors.append('missing or failed stage: ' + name)
    if report.get('providerEvidence') != 'synthetic-loopback-only':
        errors.append('ordinary runs must use only synthetic provider transport')
    if report.get('humanAcceptance') != 'not-assessed':
        errors.append('scripted success cannot establish human acceptance')
    if report.get('nativeAgent') != 'not-assessed':
        errors.append('scripted success cannot establish native agent acceptance')
    return {'passed': not errors, 'errors': errors, 'stagesPassed': sum(s.get('status') == 'passed' for s in stages),
            'requiredStages': len(expected), 'evidenceKind': 'scripted-clean-profile-onboarding'}
