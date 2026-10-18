"""Test exported runtime, not imports from a working source skill."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from export import ROOT, export


class BlueprintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='feature-blueprint-')
        cls.exported = Path(cls.tmp.name) / 'export'
        cls.manifest = export(cls.exported)
        cls.example = cls.exported / 'examples/feature-blueprint'
        cls.script = cls.exported / 'skills/feature-blueprint/scripts/blueprint.py'
        spec = importlib.util.spec_from_file_location('exported_blueprint', cls.script)
        cls.tool = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.tool)
        cls.packet = json.loads((cls.example / 'blueprint.json').read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def changed(self):
        return copy.deepcopy(self.packet)

    def test_ready_example_and_exported_model(self):
        self.tool.validate(self.packet, ready=True)
        subprocess.run(['node', '--test', str(ROOT / 'packages/feature-blueprint/model.test.mjs')],
                       env={**os.environ, 'BLUEPRINT_EXAMPLE': str(self.example)}, check=True)

    def test_missing_and_unknown_keys(self):
        for mutate in (lambda d: d.pop('rules'), lambda d: d.update(ruless=[]), lambda d: d['rules'][0].update(extra=True)):
            data = self.changed(); mutate(data)
            with self.assertRaises(ValueError): self.tool.validate(data)

    def test_invalid_types_and_identifiers(self):
        for group, field, value in [('questions', 'round', True), ('questions', 'blocking', 'yes'), ('rules', 'id', 'x\"] --> evil'), ('entities', 'fields', 'text')]:
            data = self.changed(); data[group][0][field] = value
            with self.assertRaises(ValueError): self.tool.validate(data)

    def test_dangling_links_across_the_contract(self):
        for group, field in [('questions','sources'), ('questions','decisions'), ('decisions','sources'), ('rules','decisions'), ('transitions','rules'), ('acceptance','rules'), ('slices','acceptance'), ('slices','dependsOn')]:
            data = self.changed(); data[group][0][field] = ['Missing']
            with self.assertRaisesRegex(ValueError, 'dangling'): self.tool.validate(data)

    def test_duplicate_ids_and_empty_text(self):
        data = self.changed(); data['decisions'][0]['id'] = 'S1'
        with self.assertRaisesRegex(ValueError, 'duplicate'): self.tool.validate(data)
        data = self.changed(); data['outcome'] = '  '
        with self.assertRaisesRegex(ValueError, 'text'): self.tool.validate(data)

    def test_blocking_open_or_deferred_question_prevents_ready(self):
        for status in ('open','deferred'):
            data = self.changed(); data['questions'][0].update(status=status, answer='', decisions=[])
            self.tool.validate(data)
            with self.assertRaisesRegex(ValueError, 'blocking'): self.tool.validate(data, ready=True)

    def test_resolved_question_requires_answer_and_decision(self):
        for field, value in [('answer',''), ('decisions',[])]:
            data = self.changed(); data['questions'][0][field] = value
            with self.assertRaises(ValueError): self.tool.validate(data)

    def test_uncovered_rule_and_acceptance_fail(self):
        data = self.changed(); data['rules'].append({'id':'ExtraRule','text':'Uncovered requirement','decisions':['D1']})
        with self.assertRaisesRegex(ValueError, 'rule needs'): self.tool.validate(data)
        data = self.changed()
        for row in data['slices']: row['acceptance'] = [a for a in row['acceptance'] if a != 'A1']
        with self.assertRaisesRegex(ValueError, 'scenario needs'): self.tool.validate(data)

    def test_cycle_is_not_a_build_order(self):
        data = self.changed(); data['slices'][0]['dependsOn'] = ['B3']
        with self.assertRaisesRegex(ValueError, 'cycle'): self.tool.validate(data)

    def test_invalid_fields_and_relationships(self):
        for mutate in (lambda d: d['entities'][0]['fields'].append(d['entities'][0]['fields'][0]), lambda d: d['relationships'][0].update(cardinality='many-maybe'), lambda d: d['transitions'][0].update(to='Missing')):
            data = self.changed(); mutate(data)
            with self.assertRaises(ValueError): self.tool.validate(data)

    def test_render_is_deterministic_nonmutating_and_does_not_overwrite(self):
        original = self.changed()
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'packet'
            self.tool.render(self.packet, out)
            self.assertEqual((out / 'handoff.md').read_text(encoding='utf-8'), self.tool.handoff(self.packet))
            self.assertEqual(set(p.name for p in out.iterdir()), {'handoff.md','workflow.mmd','data-model.mmd'})
            with self.assertRaises(FileExistsError): self.tool.render(self.packet, out)
        self.assertEqual(self.packet, original)

    def test_output_escapes_source_text_and_diagram_breakout(self):
        data = self.changed(); data['states'][0]['label'] = 'Draft\"] --> BAD["x'
        data['sources'][0]['excerpt'] = '<script>bad()</script>\n```\n[link](https://example.invalid)'
        flow, model = self.tool.diagrams(data)
        self.assertNotIn('Draft\"] -->', flow)
        result = self.tool.handoff(data)
        self.assertIn('    <script>bad()</script>', result)
        self.assertIn('    ```', result)
        self.assertNotIn('\n<script>', result)

    def test_public_sources_match_packet_excerpts(self):
        for source in self.packet['sources']:
            content = (self.example / source['location']).read_text(encoding='utf-8')
            self.assertIn(' '.join(source['excerpt'].split()), ' '.join(content.split()))

    def test_export_rejects_inside_checkout_existing_directory_and_traversal(self):
        with self.assertRaises(ValueError): export(ROOT / 'unused-export')
        with self.assertRaises(FileExistsError): export(self.exported)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'source'; (root / 'bundles').mkdir(parents=True)
            for bad in ('../escape', 'C:/escape', 'a/../b', 'a\\b'):
                (root / 'bundles/feature-blueprint.json').write_text(json.dumps({'files':[bad]}), encoding='utf-8')
                with self.assertRaises(ValueError): export(Path(tmp) / 'out', root=root)

    def test_all_example_assets_exported_and_network_free(self):
        self.assertTrue((self.exported / 'skills/feature-blueprint/SKILL.md').is_file())
        for asset in ('app.mjs', 'styles.css', 'model.mjs', 'blueprint.json'):
            self.assertTrue((self.example / asset).is_file())
        content = (self.example / 'index.html').read_text(encoding='utf-8') + (self.example / 'app.mjs').read_text(encoding='utf-8')
        self.assertNotIn('https://', content)
        self.assertIn('fictional', content.lower())


if __name__ == '__main__':
    unittest.main()
