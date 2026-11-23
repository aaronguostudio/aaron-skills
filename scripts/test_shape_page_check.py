"""Tests for Shape's page check (skills/feature-blueprint/scripts/check_page.py).

Synthetic pages only. Run with the other script tests:

    python3 -m unittest discover -s scripts -p 'test_*.py'
"""
import sys
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent / "skills" / "feature-blueprint"
sys.path.insert(0, str(SKILL / "scripts"))

from check_page import check  # noqa: E402

sys.path.pop(0)


def failed(raw):
    return [name for passed, name, _ in check(raw) if not passed]


def page(labels, sections, nav=None):
    nav = nav or labels
    links = "".join(f'<a href="#s{i}">{label}</a>' for i, label in enumerate(nav))
    body = "".join(
        f'<section id="s{i}" data-shape-section="{label}"><h2>{label}</h2>{content}</section>'
        for i, (label, content) in enumerate(zip(labels, sections))
    )
    return f'<html><body><nav data-section-nav>{links}</nav><main>{body}</main></body></html>'


SYSTEM = ["Requirements", "Operating model", "Before and after", "How the pieces fit", "Next steps"]
FILLER = "<p>" + " ".join(["word"] * 20) + "</p>"
GOOD_SYSTEM = page(SYSTEM, [
    '<ul><li>Stop the build step from declaring the three switches.<details><summary>Why</summary>'
    "<p>" + " ".join(["reason"] * 60) + "</p></details></li></ul>" + FILLER,
    FILLER,
    "<table><tr><th>Setting</th><th>Today</th><th>After</th></tr><tr><td>Mode</td><td>Off</td><td>Shadow</td></tr></table>" + FILLER,
    '<svg viewBox="0 0 10 10"><text x="1" y="5">Build writes ten settings</text></svg>' + FILLER,
    '<h3>Can start now</h3><ul><li>Merge the clean change. <span class="tag">Owner: release lead</span></li></ul>' + FILLER,
])


class TemplateAndPresets(unittest.TestCase):
    def test_the_shipped_template_passes(self):
        self.assertEqual(failed((SKILL / "assets" / "review-page.html").read_text()), [])

    def test_a_system_preset_page_passes(self):
        self.assertEqual(failed(GOOD_SYSTEM), [])

    def test_an_invented_label_fails(self):
        labels = SYSTEM[:3] + ["Architecture"] + SYSTEM[4:]
        self.assertIn("sections", failed(GOOD_SYSTEM.replace("How the pieces fit", "Architecture")))
        self.assertIn("sections", failed(page(labels, [FILLER] * 5)))

    def test_navigation_must_match_the_headings(self):
        raw = page(SYSTEM, [FILLER] * 5, nav=SYSTEM[:4] + ["Next"])
        self.assertIn("sections", failed(raw))


class StaticContent(unittest.TestCase):
    def test_a_frame_filled_by_script_fails(self):
        raw = GOOD_SYSTEM.replace("</table>", '</table><div data-screen-run></div><script>x.innerHTML="Build 1"</script>')
        self.assertEqual(failed(raw), ["static content"])

    def test_a_section_that_only_has_a_heading_fails(self):
        raw = page(SYSTEM, [FILLER, FILLER, "<div><b>Today</b></div>", FILLER, FILLER])
        self.assertIn("scripts off", failed(raw))

    def test_script_text_does_not_count_as_content(self):
        raw = page(SYSTEM, [FILLER, FILLER, "<script>" + " ".join(["word"] * 40) + "</script>", FILLER, FILLER])
        self.assertIn("scripts off", failed(raw))

    def test_a_diagram_without_text_fails(self):
        raw = GOOD_SYSTEM.replace("<text x=\"1\" y=\"5\">Build writes ten settings</text>", '<rect width="5" height="5"/>')
        self.assertEqual(failed(raw), ["static content"])


class OneLineItems(unittest.TestCase):
    def test_a_second_sentence_in_an_item_fails(self):
        raw = GOOD_SYSTEM.replace("declaring the three switches.", "declaring the three switches. It merges clean.")
        self.assertEqual(failed(raw), ["one line each"])

    def test_an_item_over_the_word_limit_fails(self):
        raw = GOOD_SYSTEM.replace("Merge the clean change.", "Merge " + " ".join(["the"] * 30) + " change.")
        self.assertEqual(failed(raw), ["one line each"])

    def test_text_inside_the_item_disclosure_is_not_counted(self):
        raw = GOOD_SYSTEM.replace("<p>reason", "<p>First sentence. Second sentence. reason")
        self.assertEqual(failed(raw), [])

    def test_an_inline_tag_is_not_a_second_sentence(self):
        self.assertNotIn("one line each", failed(GOOD_SYSTEM))

    def test_a_long_paragraph_in_next_steps_fails(self):
        raw = GOOD_SYSTEM.replace("<h3>Can start now</h3>", "<h3>Can start now</h3><p>" + " ".join(["detail"] * 30) + "</p>")
        self.assertIn("no prose blocks", failed(raw))


class Surface(unittest.TestCase):
    def test_closed_disclosures_keep_the_surface_short(self):
        self.assertNotIn("surface", failed(GOOD_SYSTEM))

    def test_too_many_words_on_the_surface_fails(self):
        long = "<p>" + " ".join(["word"] * 650) + "</p>"
        raw = page(SYSTEM, [FILLER, long, FILLER, FILLER, FILLER])
        self.assertEqual(failed(raw), ["surface"])


if __name__ == "__main__":
    unittest.main()
