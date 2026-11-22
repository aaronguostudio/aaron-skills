import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
import studio


class StudioTests(unittest.TestCase):
    def test_origin_limits(self):
        self.assertEqual(
            studio.origin("http://127.0.0.1:4178/"), "http://127.0.0.1:4178"
        )
        for value in [
            "http://demo.example",
            "https://name:pw@demo.example",
            "https://demo.example/a",
            "https://demo.example?x=1",
        ]:
            with self.assertRaises(ValueError):
                studio.origin(value)

    def test_pin_and_explicit_offline_integrity(self):
        from argparse import Namespace

        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp) / "profile"
            project = Path(temp) / "film"
            home.mkdir()
            project.mkdir()
            profile = {
                "workspace": str(uuid.uuid4()),
                "slot": str(uuid.uuid4()),
                "origin": "https://studio.example",
                "vault": "file",
                "expires": "2099-01-01T00:00:00Z",
            }
            pack = {
                "schema": 1,
                "workspace": profile["workspace"],
                "template": str(uuid.uuid4()),
                "version": 1,
                "logo": None,
                "presentation": {
                    "title": "Product update",
                    "brand": {
                        "name": "Example",
                        "primary": "#001122",
                        "accent": "#eee111",
                    },
                    "layout": {"preset": "studio-cobalt"},
                    "cover": {
                        "preset": "cobalt-signal",
                        "colors": {
                            "background": "#001122",
                            "accent": "#eee111",
                            "foreground": "#ffffff",
                        },
                    },
                },
            }
            payload = json.dumps(pack)
            response = {"payload": payload, "sha256": studio.digest(payload.encode())}
            args = Namespace(project=project, template=None, offline=False)
            with (
                patch.object(studio, "credential", return_value="test"),
                patch.object(studio, "call", return_value=response),
            ):
                release = studio.resolve(home, profile, args)
            args.offline = True
            with patch.object(
                studio,
                "call",
                side_effect=AssertionError("Offline resolution used the network"),
            ):
                self.assertEqual(
                    studio.resolve(home, profile, args)["sha256"], release["sha256"]
                )
            cached = Path(release["presentation"]).with_name("pack.json")
            cached.write_text("changed")
            with self.assertRaisesRegex(ValueError, "immutable release"):
                studio.resolve(home, profile, args)
            with self.assertRaisesRegex(ValueError, "another workspace"):
                studio.resolve(home, {**profile, "workspace": str(uuid.uuid4())}, args)
