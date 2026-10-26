import json
from pathlib import Path
import tempfile
import os
import stat
import subprocess
import base64
import shutil
import unittest
from revise_capture import digest, revise
from capture_view import inspect_capture, validate_masks

class RevisionTests(unittest.TestCase):
    def assert_private(self, path, directory=False):
        if os.name != 'nt':
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o700 if directory else 0o600)
            return
        literal = str(path).replace("'", "''")
        script = ("$ErrorActionPreference='Stop';$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;"
                  f"$rules=@((Get-Acl -LiteralPath '{literal}').Access | Where-Object {{$_.AccessControlType -eq 'Allow'}});"
                  "if(!$rules.Count){exit 1};foreach($r in $rules){if($r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $me){exit 2}}")
        result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand',
                                 base64.b64encode(script.encode('utf-16le')).decode()], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_revision_is_private_with_a_permissive_shell_umask(self):
        previous = os.umask(0o022)
        try:
            self.apply({'result': {'caption': 'Revised'}})
        finally:
            os.umask(previous)
        self.assert_private(self.output, directory=True)
        for path in self.output.rglob('*'):
            if path.is_file():
                self.assert_private(path)
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'; self.source.mkdir()
        self.output = self.root / 'revision'
        self.patch = self.root / 'patch.json'
        (self.source / 'capture.json').write_text(json.dumps({'version': 1, 'status': 'passed', 'viewport': {'w': 1440, 'h': 900}}))
        (self.source / 'steps.json').write_text(json.dumps([{'id': 'result', 'caption': 'Original', 'kind': 'action', 'startMs': 100, 'endMs': 200, 'shot': 'shots/result.png', 'clicks': []}]))
        (self.source / 'video.webm').write_bytes(b'original video')
        (self.source / 'shots').mkdir(); (self.source / 'shots/result.png').write_bytes(b'original screenshot')

    def apply(self, changes):
        self.patch.write_text(json.dumps({'steps': changes}))
        return revise(self.source, self.patch, self.output)

    def test_caption_and_focus_derivative_preserves_source_and_media(self):
        before = {p.relative_to(self.source).as_posix(): digest(p) for p in self.source.rglob('*') if p.is_file()}
        result = self.apply({'result': {'caption': 'Revised', 'focus': [{'box': [10, 20, 80, 40], 'fromMs': 100, 'toMs': 200}]}})
        self.assertEqual(result['sourceHashes'], before)
        self.assertFalse(result['businessAssertionsReplayed'])
        for name, expected in before.items():
            self.assertEqual(digest(self.source / name), expected)
            if name != 'steps.json': self.assertEqual(digest(self.output / name), expected)
        self.assertEqual(json.loads((self.output / 'steps.json').read_text())[0]['caption'], 'Revised')
        (self.output / 'video.webm').write_bytes(b'changed derivative')
        self.assertEqual(digest(self.source / 'video.webm'), before['video.webm'])
        with self.assertRaisesRegex(ValueError, 'new folder'): revise(self.source, self.patch, self.output)

    def test_shared_mask_contract(self):
        fixtures = json.loads((Path(__file__).resolve().parents[1] / 'evals/fixtures/mask-cases.json').read_text())
        for fixture in fixtures:
            with self.subTest(case=fixture['id']):
                capture = json.loads((self.source / 'capture.json').read_text())
                steps = json.loads((self.source / 'steps.json').read_text())
                if 'masks' in fixture: capture['masks'] = fixture['masks']
                if fixture['accepted']: validate_masks(capture, steps)
                else:
                    with self.assertRaises(ValueError): validate_masks(capture, steps)

    def test_masks_add_preserve_replace_and_remove_without_mutating_raw_evidence(self):
        before = {p.relative_to(self.source).as_posix(): digest(p) for p in self.source.rglob('*') if p.is_file()}
        mask = {'box': [10,20,80,40], 'fromMs':100, 'toMs':200}
        self.patch.write_text(json.dumps({'masks':[mask]}))
        manifest = revise(self.source, self.patch, self.output)
        self.assertEqual(inspect_capture(self.output)['masks'], [mask])
        self.assertEqual(manifest['derivedCaptureSha256'], digest(self.output / 'capture.json'))
        for name, sha in before.items():
            self.assertEqual(digest(self.source / name), sha)
            if name != 'capture.json': self.assertEqual(digest(self.output / name), sha)
        self.assertFalse(manifest['businessAssertionsReplayed'])
        self.assert_private(self.output / 'capture.json')
        # A caption correction preserves masking; the next correction can remove it.
        self.patch.write_text(json.dumps({'steps':{'result':{'caption':'Same permitted result'}}}))
        kept = self.root / 'kept'; revise(self.output, self.patch, kept)
        self.assertEqual(inspect_capture(kept)['masks'], [mask])
        self.patch.write_text(json.dumps({'masks':[]}))
        removed = self.root / 'removed'; revise(kept, self.patch, removed)
        self.assertEqual(inspect_capture(removed)['masks'], [])
        self.assertEqual(digest(removed / 'video.webm'), before['video.webm'])

    def test_invalid_masks_refused_before_output(self):
        for masks in [None, [{'box':[0,0,2000,20],'fromMs':100,'toMs':200}],
                      [{'box':[0,0,20,20],'fromMs':0,'toMs':200}]]:
            self.patch.write_text(json.dumps({'masks':masks}))
            with self.subTest(masks=masks), self.assertRaises(ValueError):
                revise(self.source, self.patch, self.output)
            self.assertFalse(self.output.exists())

    def test_rejects_evidence_changes_unknown_ids_bad_boxes_and_times_before_output(self):
        for change in [
            {'missing': {'caption': 'Unknown'}}, {'result': {'endMs': 999}},
            {'result': {'clicks': []}}, {'result': {'caption': ''}}, {'result': None},
            {'result': {'focus': [{'box': [-1, 0, 20, 20], 'fromMs': 100, 'toMs': 200}]}},
            {'result': {'focus': [{'box': [1400, 0, 100, 20], 'fromMs': 100, 'toMs': 200}]}},
            {'result': {'focus': [{'box': [0, 0, 10, 20], 'fromMs': 0, 'toMs': 200}]}},
        ]:
            with self.subTest(change=change), self.assertRaises(ValueError): self.apply(change)
            self.assertFalse(self.output.exists())

    def test_failed_capture_and_symlink_assets_refused(self):
        path = self.source / 'capture.json'; capture = json.loads(path.read_text())
        capture['status'] = 'failed'; path.write_text(json.dumps(capture))
        with self.assertRaisesRegex(ValueError, 'Only passed'): self.apply({'result': {'caption': 'Revised'}})
        capture['status'] = 'passed'; path.write_text(json.dumps(capture))
        if os.name == 'nt':
            outside = self.root / 'outside'; outside.mkdir(); (outside / 'result.png').write_bytes(b'not captured')
            shutil.rmtree(self.source / 'shots')
            subprocess.run(['node', '-e', "require('fs').symlinkSync(process.argv[1],process.argv[2],'junction')", str(outside), str(self.source / 'shots')], check=True)
        else:
            (self.source / 'video.webm').unlink(); (self.source / 'video.webm').symlink_to(self.root / 'outside')
            (self.root / 'outside').write_bytes(b'not captured')
        with self.assertRaisesRegex(ValueError, 'regular files'): self.apply({'result': {'caption': 'Revised'}})

    def test_output_overlap_and_git_are_refused(self):
        self.patch.write_text(json.dumps({'steps': {'result': {'caption': 'Revised'}}}))
        for output in [self.source, self.source / 'derived', self.root]:
            with self.assertRaises(ValueError): revise(self.source, self.patch, output)
        repo = self.root / 'repo'; repo.mkdir(); (repo / '.git').write_text('gitdir: elsewhere')
        with self.assertRaisesRegex(ValueError, 'outside Git'): revise(self.source, self.patch, repo / 'derived')

    def test_windows_drive_assets_are_refused_on_every_host_before_output(self):
        path = self.source / 'steps.json'
        steps = json.loads(path.read_text())
        for shot in ['C:/outside.png', 'C:outside.png', r'\\server\share\outside.png']:
            steps[0]['shot'] = shot
            path.write_text(json.dumps(steps))
            with self.assertRaisesRegex(ValueError, 'asset|inside'):
                self.apply({'result': {'caption': 'Revised'}})
            self.assertFalse(self.output.exists())

    def evidence_step(self, complete=True):
        path = self.source / 'steps.json'; step = json.loads(path.read_text())[0]
        step['targets'] = {name: {'boxes': [{'x': x, 'y': 20, 'w': 80, 'h': 40}], 'fromMs': 120, 'toMs': 190}
                           for name, x in [('count', 10), ('total', 110), ('status', 210)]}
        step['evidence'] = {'count': {'kind': 'integer', 'expected': 2}, 'total': {'kind': 'dollarMinor', 'expected': 200000},
                            'status': {'kind': 'text', 'expected': 'Approved'}}
        step['focus'] = [{'box': [10, 20, 280 if complete else 80, 40], 'fromMs': 120, 'toMs': 190}]
        path.write_text(json.dumps([step])); return step

    def test_named_geometry_repairs_first_pass_omission_without_touching_capture_evidence(self):
        before = self.evidence_step(complete=False)
        review = inspect_capture(self.source)
        self.assertFalse(review['readyToRender'])
        self.assertIn('total', review['issues'][0])
        self.assertEqual(review['steps'][0]['targets'], before['targets'], 'bad focus remains inspectable so it can be repaired offline')
        with self.assertRaisesRegex(ValueError, 'omits checked'):
            inspect_capture(self.source, strict=True)
        self.apply({'result': {'caption': 'Two invoices approved', 'focusTargets': ['count', 'total', 'status']}})
        after = json.loads((self.output / 'steps.json').read_text())[0]
        self.assertEqual(after['focus'][0]['box'], {'x': 10, 'y': 20, 'w': 280, 'h': 40})
        for key in ('evidence', 'targets', 'clicks', 'shot', 'startMs', 'endMs'):
            self.assertEqual(after[key], before[key])
        self.assertTrue(inspect_capture(self.output, strict=True)['readyToRender'])
        self.assertEqual(json.loads((self.source / 'steps.json').read_text())[0], before)

    def test_target_selection_and_manual_boxes_cannot_omit_checked_metrics(self):
        self.evidence_step()
        for change in [
            {'focusTargets': ['count', 'total']}, {'focusTargets': ['unknown']}, {'focusTargets': ['count', 'count']},
            {'focusTargets': []}, {'focusTargets': ['count', 'total', 'status'], 'focus': []}, {'focus': []},
            {'focus': [{'box': [10, 20, 80, 40], 'fromMs': 120, 'toMs': 190}]},
            {'focus': [{'box': [10, 20, 280, 40], 'fromMs': 150, 'toMs': 190}]},
        ]:
            with self.subTest(change=change), self.assertRaises(ValueError): self.apply({'result': change})
            self.assertFalse(self.output.exists())

    def test_incompatible_saved_geometry_cannot_be_projected_on_a_different_step_time(self):
        step = self.evidence_step()
        for invalid in [dict(boxes=[{'x': -1, 'y': 0, 'w': 10, 'h': 20}], fromMs=120, toMs=190),
                        dict(boxes=[{'x': 110, 'y': 20, 'w': 80, 'h': 40}], fromMs=195, toMs=200)]:
            step['targets']['total'] = invalid
            (self.source / 'steps.json').write_text(json.dumps([step]))
            with self.assertRaises(ValueError): self.apply({'result': {'focusTargets': ['count', 'total', 'status']}})
            self.assertFalse(self.output.exists())

if __name__ == '__main__': unittest.main()
