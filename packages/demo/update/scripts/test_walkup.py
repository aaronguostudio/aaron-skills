"""Tests for the walk-up block in references/walkthrough.md (step 1). Run: python3 -m unittest discover -s scripts -p 'test_*.py'

The block is taken out of the document and run with bash, so a rewrite that breaks the rule
(start at the working directory, stop at $HOME, never look above it) fails here.
"""

import os
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

DOC = Path(__file__).resolve().parent.parent / "references" / "walkthrough.md"
NO_ADAPTER = "no adapter"


def walkup_block():
    """The one fenced bash block in the document that looks for demo-capture/config.mjs."""
    blocks, current = [], None
    for line in DOC.read_text(encoding="utf-8").splitlines():
        fence = line.strip()
        if current is None and fence == "```bash":
            current = []
        elif current is not None and fence == "```":
            blocks.append(textwrap.dedent("\n".join(current)))
            current = None
        elif current is not None:
            current.append(line)
    found = [block for block in blocks if "demo-capture/config.mjs" in block]
    if len(found) != 1:
        raise AssertionError("expected one walk-up block in %s, found %d" % (DOC, len(found)))
    return found[0]


class WalkUpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.block = walkup_block()

    def setUp(self):
        # realpath: bash reports the physical working directory, and /tmp may be a symlink.
        self.root = Path(os.path.realpath(tempfile.mkdtemp()))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)

    def folder(self, *parts, adapter=False):
        path = self.root.joinpath(*parts)
        path.mkdir(parents=True, exist_ok=True)
        if adapter:
            (path / "demo-capture").mkdir()
            (path / "demo-capture" / "config.mjs").write_text("export default {}\n")
        return path

    def walk(self, cwd, home):
        result = subprocess.run(
            ["bash", "-c", self.block],
            cwd=cwd,
            env={"HOME": str(home), "PATH": os.environ["PATH"]},
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def test_finds_an_adapter_above_the_working_directory_inside_home(self):
        home = self.folder("home")
        project = self.folder("home", "work", "proj", adapter=True)
        deep = self.folder("home", "work", "proj", "src", "deep")
        self.assertEqual(self.walk(deep, home), str(project))
        self.assertEqual(self.walk(project, home), str(project))

    def test_a_config_above_home_is_not_found(self):
        self.folder(adapter=True)  # the root of the fixture, above home
        home = self.folder("me")
        work = self.folder("me", "work")
        self.assertEqual(self.walk(work, home), NO_ADAPTER)
        self.assertEqual(self.walk(home, home), NO_ADAPTER)

    def test_a_working_directory_outside_home_is_checked_alone(self):
        home = self.folder("home")
        project = self.folder("outside", "proj", adapter=True)
        sub = self.folder("outside", "proj", "sub")
        self.assertEqual(self.walk(project, home), str(project))
        self.assertEqual(self.walk(sub, home), NO_ADAPTER)

    def test_home_itself_is_checked(self):
        home = self.folder("home", adapter=True)
        inside = self.folder("home", "x")
        self.assertEqual(self.walk(inside, home), str(home))

    def test_no_adapter_anywhere(self):
        home = self.folder("home")
        inside = self.folder("home", "a", "b")
        self.assertEqual(self.walk(inside, home), NO_ADAPTER)

    def test_an_empty_home_still_stops(self):
        inside = self.folder("a", "b")
        self.assertEqual(self.walk(inside, ""), NO_ADAPTER)


if __name__ == "__main__":
    unittest.main()
