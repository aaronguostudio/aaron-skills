"""Tests for mark_screenshot.py (skipped when Pillow is missing)."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mark_screenshot  # noqa: E402

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None


@unittest.skipIf(Image is None, "Pillow is not installed")
class MarkScreenshotTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.src = self.dir / "in.png"
        Image.new("RGB", (400, 300), "white").save(self.src)

    def test_box_coordinates_stay_in_original_pixels_after_a_crop(self):
        out = self.dir / "out.png"
        crop = mark_screenshot.parse_rect("100,50,400,300")
        box = mark_screenshot.parse_rect("200,150,260,180:1")
        self.assertEqual(mark_screenshot.mark(self.src, out, crop, [box]), (300, 250))
        with Image.open(out) as im:
            # The box's top edge sits just above y=150-50=100, at x=(200+260)/2-100=130.
            column = [im.getpixel((130, y)) for y in range(90, 101)]
            self.assertIn(mark_screenshot.RED, column)
            self.assertEqual(im.getpixel((10, 10)), (255, 255, 255))

    def test_rejects_an_inverted_rectangle(self):
        with self.assertRaises(Exception):
            mark_screenshot.parse_rect("50,50,10,10")

    def test_steps_boxes_scale_from_viewport_to_image_pixels(self):
        # A 2x screenshot of a 200x150 viewport: the recorded box doubles.
        steps = self.dir / "steps.json"
        later = {"tMs": 2, "x": 10, "y": 10, "box": {"x": 5, "y": 5, "w": 10, "h": 10}}
        steps.write_text(json.dumps([{"id": "save", "clicks": [{"tMs": 1, "x": 60, "y": 45, "box": {"x": 50, "y": 40, "w": 20, "h": 10}}, later]}]))
        (self.dir / "capture.json").write_text(json.dumps({"viewport": {"w": 200, "h": 150}}))
        boxes = mark_screenshot.boxes_from_steps(steps, "save", "2", 400)
        self.assertEqual(boxes, [((100, 80, 140, 100), "2")])  # the first click only: the shot shows it
        self.assertEqual(len(mark_screenshot.boxes_from_steps(steps, "save", "2", 400, "all")), 2)
        with self.assertRaises(ValueError):
            mark_screenshot.boxes_from_steps(steps, "nope", None, 400)

    def test_auto_crop_frames_the_boxes_and_stays_inside_the_image(self):
        crop, _ = mark_screenshot.auto_crop([((20, 20, 60, 40), None)], (1440, 900), margin=100, min_size=(760, 475))
        x0, y0, x1, y1 = crop
        self.assertEqual((x0, y0), (0, 0))  # pushed back inside the image
        self.assertEqual((x1 - x0, y1 - y0), (760, 475))
        self.assertTrue(x0 <= 20 and x1 >= 60 and y0 <= 20 and y1 >= 40)
        self.assertIsNone(mark_screenshot.auto_crop([], (1440, 900)))

    def test_cli_marks_a_step_from_its_capture(self):
        steps = self.dir / "steps.json"
        steps.write_text(json.dumps([{"id": "open", "clicks": [{"tMs": 1, "x": 210, "y": 160, "box": {"x": 200, "y": 150, "w": 20, "h": 20}}]}]))
        out = self.dir / "marked.png"
        rc = mark_screenshot.main([str(self.src), str(out), "--steps", str(steps), "--step", "open", "--label", "1", "--crop", "auto"])
        self.assertEqual(rc, 0)
        with Image.open(out) as im:
            self.assertEqual(im.size, (400, 300))  # the image is smaller than the minimum crop
            self.assertIn(mark_screenshot.RED, [im.getpixel((210, y)) for y in range(140, 151)])


if __name__ == "__main__":
    unittest.main()
