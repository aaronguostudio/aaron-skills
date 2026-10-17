"""Tests for build_page.py. Run: python3 -m unittest discover -s scripts -p 'test_*.py'"""

import base64
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_page  # noqa: E402

# A 1x1 PNG and a minimal JPEG header are enough: the builder sniffs bytes, it does not decode.
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


class BuildPageTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / "shots").mkdir()
        (self.dir / "shots" / "one.png").write_bytes(PNG)
        (self.dir / "shots" / "two.jpg").write_bytes(JPEG)

    def build(self, text, **kw):
        path = self.dir / "message.md"
        path.write_text(text, encoding="utf-8")
        return build_page.build(path, max_width=0, **kw)

    def plain_from_page(self, page):
        raw = re.search(r'<script type="application/json" id="plain-text">(.*?)</script>', page, re.S).group(1)
        return json.loads(raw.replace("<\\/", "</"))

    def test_steps_keep_their_numbers_around_screenshots(self):
        page, plain, figures, _ = self.build(
            "1. Open **Settings**.\n\n![The settings page](shots/one.png)\n\n2. Click *Save*.\n3. Done.\n"
        )
        self.assertEqual(figures, 1)
        self.assertIn("<ol>\n<li>Open <strong>Settings</strong>.</li>\n</ol>", page)
        self.assertIn('<ol start="2">', page)
        self.assertIn("1. Open Settings.\n\n2. Click Save.\n3. Done.", plain)
        self.assertNotIn("settings page", plain)  # screenshots never leak into the text people send

    def test_screenshots_are_inlined_with_their_real_type(self):
        page, _, figures, _ = self.build("![](shots/one.png)\n\n![Second](shots/two.jpg)\n")
        self.assertEqual(figures, 2)
        self.assertIn('src="data:image/png;base64,', page)
        self.assertIn('src="data:image/jpeg;base64,', page)
        self.assertNotIn("shots/one.png", page)
        self.assertIn("Copy image 2", page)

    def test_missing_screenshot_is_an_error_not_a_gap(self):
        with self.assertRaises(build_page.BuildError):
            self.build("![Nope](shots/missing.png)\n")

    def test_explicit_line_breaks_inside_a_paragraph_are_kept(self):
        page, plain, _, _ = self.build("Thanks,  \nAaron\n")
        self.assertIn("<p>Thanks,<br>\nAaron</p>", page)
        self.assertEqual(plain, "Thanks,\nAaron\n")

    def test_soft_wraps_join_in_html_and_clipboard_including_lists_and_quotes(self):
        page, plain, _, _ = self.build("Review the selected\ninvoices before approving.\n\n- Check the\n  total first.\n\n> One wrapped\n> quote.\n")
        self.assertIn("<p>Review the selected invoices before approving.</p>", page)
        self.assertIn("<li>Check the total first.</li>", page)
        self.assertIn("<blockquote>One wrapped quote.</blockquote>", page)
        self.assertIn("Review the selected invoices before approving.", plain)
        self.assertEqual(self.plain_from_page(page), plain)

    def test_backslash_hard_break_and_paragraph_boundaries(self):
        page, plain, _, _ = self.build("Line one\\\nLine two\n\nNext paragraph.\n")
        self.assertIn("<p>Line one<br>\nLine two</p>", page)
        self.assertIn("Line one\nLine two\n\nNext paragraph.", plain)

    def test_nested_bullets(self):
        page, plain, _, _ = self.build("- Presets:\n  - Typical month\n  - Bank-side items\n- Tips\n")
        self.assertIn("<li>Presets:\n<ul>", page)
        self.assertIn("• Presets:\n   • Typical month\n   • Bank-side items\n• Tips", plain)

    def test_html_is_escaped_and_unsafe_links_are_dropped(self):
        page, plain, _, _ = self.build("Use <b>this</b> & [docs](https://example.com/a?b=1&c=2) not [x](javascript:alert(1)).\n")
        self.assertIn("Use &lt;b&gt;this&lt;/b&gt; &amp;", page)
        self.assertIn('<a href="https://example.com/a?b=1&amp;c=2">docs</a>', page)
        self.assertNotIn("javascript:", page.split('id="plain-text"')[0])
        self.assertIn("docs (https://example.com/a?b=1&c=2)", plain)

    def test_plain_text_survives_a_closing_script_tag(self):
        page, plain, _, _ = self.build("Type `</script>` here.\n")
        self.assertEqual(self.plain_from_page(page), plain)
        self.assertEqual(page.count("</script>"), 2)

    def test_placeholders_in_the_message_are_not_expanded(self):
        page, _, _, _ = self.build("---\ntitle: Real title\n---\nLiteral {{TITLE}} stays.\n")
        self.assertIn("<p>Literal {{TITLE}} stays.</p>", page)

    def test_front_matter_sets_title_hint_and_language(self):
        page, _, _, _ = self.build("---\ntitle: 给 Lin 的更新\nhint: 先粘贴文字\nlang: zh-CN\n---\n你好\n")
        self.assertIn("<title>给 Lin 的更新</title>", page)
        self.assertIn("先粘贴文字", page)
        self.assertIn('<html lang="zh-CN">', page)

    def test_fragment_has_no_document_skeleton(self):
        page, _, _, _ = self.build("Hello\n", fragment=True)
        self.assertNotIn("<!doctype", page.lower())
        self.assertNotIn("<body>", page)
        self.assertTrue(page.startswith("<title>"))

    def test_no_rich_copy_button_without_screenshots(self):
        page, _, _, _ = self.build("Just text.\n")
        self.assertNotIn('id="copy-rich"', page)
        page, _, _, _ = self.build("![](shots/one.png)\n")
        self.assertIn('id="copy-rich"', page)

    def test_walkthrough_video_is_shown_but_never_copied(self):
        (self.dir / "run").mkdir()
        (self.dir / "run" / "walkthrough.mp4").write_bytes(b"\x00" * 2048)
        message = "---\nvideo: run/walkthrough.mp4\n---\nHi\n"
        page, plain, _, _ = self.build(message, out_path=self.dir / "out" / "page.html")
        self.assertIn('<video controls preload="metadata" src="../run/walkthrough.mp4">', page)
        copied = page.split('<div id="message">')[1].split("</article>")[0]
        self.assertNotIn("<video", copied)
        self.assertNotIn("walkthrough", plain)
        self.assertIn('href="../run/walkthrough.mp4" download', page)
        page, _, _, _ = self.build(message, fragment=True)
        self.assertIn('src="walkthrough.mp4"', page)
        self.assertNotIn(" download", page)  # wrapped hosts block download links

    def test_several_videos_each_get_a_player_and_a_label(self):
        for name in ("concise.mp4", "talk.mp4"):
            (self.dir / name).write_bytes(b"\x00" * 2048)
        message = "---\nvideo: concise.mp4 | Concise, 2:02\nvideo: talk.mp4 | Conversational, 2:57\n---\nHi\n"
        page, plain, _, _ = self.build(message, fragment=True)
        self.assertEqual(page.count("<video "), 2)
        self.assertLess(page.index('src="concise.mp4"'), page.index('src="talk.mp4"'))
        self.assertIn("<h3>Concise, 2:02</h3>", page)
        self.assertIn("<h3>Conversational, 2:57</h3>", page)
        self.assertIn("Videos to attach", page)
        self.assertIn("<code>talk.mp4</code>", page)
        copied = page.split('<div id="message">')[1].split("</article>")[0]
        self.assertNotIn("<video", copied)
        self.assertNotIn("concise", plain)

    @unittest.skipIf(shutil.which("ffmpeg") is None, "needs ffmpeg")
    def test_a_video_shows_a_frame_from_its_start_instead_of_black(self):
        video = self.dir / "clip.mp4"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=white:s=64x48:d=3", "-pix_fmt", "yuv420p", str(video)],
            check=True,
        )
        page, _, _, _ = self.build("---\nvideo: clip.mp4\n---\nHi\n", fragment=True)
        self.assertIn('poster="data:image/jpeg;base64,', page)

    def test_missing_video_is_an_error(self):
        with self.assertRaises(build_page.BuildError):
            self.build("---\nvideo: nope.mp4\n---\nHi\n")


if __name__ == "__main__":
    unittest.main()
