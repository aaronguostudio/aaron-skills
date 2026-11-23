"""Tests for Deliver's request check (skills/deliver-work/scripts/check_request.py).

Synthetic messages only. Run with the other script tests:

    python3 -m unittest discover -s scripts -p 'test_*.py'
"""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "skills" / "deliver-work"
sys.path.insert(0, str(ROOT / "scripts"))

from check_request import check  # noqa: E402

sys.path.pop(0)


def failed(raw, **kwargs):
    results, _ = check(raw, **kwargs)
    return [name for passed, name, _ in results if not passed]


GOOD = """Hi Lena, I need a second look at the import fix and one number from the staging run, which I can't reach. Two things:

1. Review the change: https://example.com/changes/88 (3 files, 120 lines).
2. Run the import on staging and reply with the count of rejected rows:
   ./import.sh --env staging --dry-run

What it does: rows with an empty postal code are now imported with a warning instead of being rejected.

[screenshot: the import summary page with the new warning count]

Why: last week's file lost 40 rows this way. Known gaps are in the change description.
"""


class ExampleInTheReference(unittest.TestCase):
    def test_the_published_example_passes_its_own_check(self):
        text = (ROOT / "references" / "requests.md").read_text()
        example = re.search(r"## Example.*?```text\n(.*?)```", text, flags=re.S).group(1)
        self.assertEqual(failed(example), [])


class Shape(unittest.TestCase):
    def test_a_well_shaped_request_passes(self):
        self.assertEqual(failed(GOOD), [])

    def test_summary_reports_where_the_asks_end_and_the_placeholder(self):
        _, summary = check(GOOD)
        self.assertTrue(summary[0].startswith("every ask is stated by word "))
        self.assertIn("placeholder", summary[1])

    def test_no_numbered_list_fails(self):
        raw = "Hi Lena, could you review the change and run the import on staging?\n\n[screenshot: summary page]\n"
        self.assertIn("asks list", failed(raw))

    def test_background_before_the_list_fails_the_opener(self):
        background = " ".join(["background"] * 45)
        raw = GOOD.replace("Two things:", f"{background} Two things:")
        self.assertIn("opener", failed(raw))

    def test_opener_number_must_match_the_list(self):
        self.assertEqual(failed(GOOD.replace("Two things:", "Three things:")), ["ask count"])

    def test_digit_in_the_opener_counts(self):
        self.assertEqual(failed(GOOD.replace("Two things:", "2 things:")), [])

    def test_long_item_fails(self):
        raw = GOOD.replace("(3 files, 120 lines).", "(3 files, 120 lines). " + " ".join(["because"] * 40))
        self.assertIn("item length", failed(raw))

    def test_request_wording_after_the_list_fails(self):
        raw = GOOD.replace("Known gaps are", "Please also commit the report. Known gaps are")
        self.assertEqual(failed(raw), ["after the list"])

    def test_second_numbered_list_fails(self):
        raw = GOOD + "\nSteps for the run:\n\n1. Check out the branch.\n2. Push the report.\n"
        self.assertIn("one list", failed(raw))

    def test_long_paragraph_after_the_list_fails(self):
        raw = GOOD.replace("What it does:", "What it does: " + " ".join(["detail"] * 45))
        self.assertIn("paragraphs", failed(raw))

    def test_each_bullet_is_measured_on_its_own(self):
        bullets = "\n".join("- " + " ".join(["point"] * 20) for _ in range(3))
        raw = GOOD.replace("Why:", f"Where to look:\n{bullets}\n\nWhy:")
        self.assertNotIn("paragraphs", failed(raw))

    def test_missing_picture_fails_unless_nothing_shows_on_a_screen(self):
        raw = GOOD.replace("[screenshot: the import summary page with the new warning count]\n\n", "")
        self.assertEqual(failed(raw), ["picture"])
        self.assertEqual(failed(raw, visual=False), [])

    def test_image_line_is_a_picture_and_is_not_counted_as_words(self):
        raw = GOOD.replace(
            "[screenshot: the import summary page with the new warning count]",
            "![The import summary page with the new warning count](shots/summary.png)",
        )
        self.assertEqual(failed(raw), [])
        self.assertLess(_words(raw), _words(GOOD))

    def test_over_budget_fails(self):
        raw = GOOD + "\n" + "\n\n".join(" ".join(["more"] * 40) for _ in range(4)) + "\n"
        self.assertEqual(failed(raw), ["length"])

    def test_spacing_around_a_slash_does_not_change_the_count(self):
        spaced = GOOD.replace("(3 files, 120 lines)", "(3 files, +120 / -4 lines)")
        closed = GOOD.replace("(3 files, 120 lines)", "(3 files, +120/-4 lines)")
        self.assertEqual(_words(spaced), _words(closed))

    def test_front_matter_is_not_part_of_the_message(self):
        raw = "---\ntitle: For Lena: import fix review\nlang: en\n---\n" + GOOD
        self.assertEqual(failed(raw), [])
        self.assertEqual(_words(raw), _words(GOOD))


class ListParsing(unittest.TestCase):
    def test_fenced_command_under_an_item_stays_in_the_item(self):
        raw = GOOD.replace("   ./import.sh --env staging --dry-run", "```bash\n./import.sh --env staging --dry-run\n```")
        self.assertEqual(failed(raw), [])

    def test_blank_lines_between_items_keep_one_list(self):
        raw = GOOD.replace("\n2. Run the import", "\n\n2. Run the import")
        self.assertEqual(failed(raw), [])

    def test_unindented_text_between_items_ends_the_list(self):
        raw = GOOD.replace("\n2. Run the import", "\nSome background that belongs at the end.\n2. Run the import")
        self.assertIn("one list", failed(raw))

    def test_an_ask_phrased_as_a_need_after_the_list_fails(self):
        raw = GOOD.replace("Known gaps are", "If you can check the old files too, I only need the count. Known gaps are")
        self.assertEqual(failed(raw), ["after the list"])


def _words(raw):
    results, _ = check(raw)
    detail = next(detail for _, name, detail in results if name == "length")
    return int(detail.split()[0])


if __name__ == "__main__":
    unittest.main()
