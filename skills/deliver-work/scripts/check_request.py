#!/usr/bin/env python3
"""Check a request message before it is handed to its sender.

Reads the message as its receiver would (front matter, Markdown markers and
image lines removed) and checks the shape in references/requests.md.

    python3 check_request.py MESSAGE [--no-visual]

Exit status 0 when every check passes, 1 when one fails. Standard library only.
"""
import argparse
import re
import sys
from pathlib import Path

OPENER_MAX = 40
ITEM_MAX = 40
PARAGRAPH_MAX = 45
MESSAGE_MAX = 200

NUMBER_WORDS = "one two three four five six seven eight nine ten eleven twelve".split()
ITEM = re.compile(r"^\s{0,3}(\d+)\.\s+")
IMAGE = re.compile(r"^\s*!\[")
PLACEHOLDER = re.compile(r"^\s*\[screenshot\b", re.I)
BULLET = re.compile(r"^\s*[-*]\s+")
FENCE = re.compile(r"^\s*```")
REQUEST_WORDING = re.compile(
    r"\b(please|could you|can you|would you|will you|if you (?:can|could)|"
    r"i (?:only |just )?need|i(?:'d| would) like|let me know|send me|tell me|"
    r"make sure|remember to|don't forget|do not forget)\b",
    re.I,
)


def strip_front_matter(raw):
    if raw.startswith("---\n"):
        end = raw.find("\n---", 4)
        if end != -1:
            return raw[end + 4:]
    return raw


def clean(line):
    """One line as the receiver reads it: list, heading and emphasis markers removed."""
    line = re.sub(r"^\s*(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)", "", line)
    line = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1 \2", line)
    return line.replace("**", "").replace("`", "")


def words(line):
    """Words in one line. Spacing around a slash does not change the count."""
    return len(re.sub(r"\s*/\s*", "/", clean(line)).split())


def count(lines):
    """Words the receiver reads. An image line is a picture, not words."""
    return sum(words(line) for line in lines if not IMAGE.match(line))


def continues(lines, i, expected):
    """After a blank line at i: does the list go on (next item, indented line, fence)?"""
    for line in lines[i + 1:]:
        if line.strip():
            m = ITEM.match(line)
            return bool((m and int(m.group(1)) == expected) or line[:1] in " \t" or FENCE.match(line))
    return False


def parse(lines):
    """Split the body into opener lines, list items and the lines after the list."""
    start = next((i for i, line in enumerate(lines) if (m := ITEM.match(line)) and m.group(1) == "1"), None)
    if start is None:
        return lines, [], []
    items, i, fenced = [], start, False
    while i < len(lines):
        line = lines[i]
        m = ITEM.match(line)
        if FENCE.match(line):
            fenced = not fenced
        elif fenced:
            items[-1].append(line)
        elif m and int(m.group(1)) == len(items) + 1:
            items.append([line])
        elif line.strip() and line[:1] in " \t":
            items[-1].append(line)
        elif line.strip():
            break
        elif not continues(lines, i, len(items) + 1):
            break
        i += 1
    return lines[:start], items, lines[i:]


def units(lines):
    """Paragraphs and bullets after the list, each as a list of lines."""
    out, current = [], []
    for line in lines:
        is_picture = IMAGE.match(line) or PLACEHOLDER.match(line)
        if is_picture or FENCE.match(line) or not line.strip():
            if current:
                out.append(current)
            current = []
        elif BULLET.match(line) or ITEM.match(line):
            if current:
                out.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        out.append(current)
    return out


def check(raw, visual=True):
    """Return (results, summary lines). Each result is (passed, name, detail)."""
    lines = strip_front_matter(raw).splitlines()
    opener, items, rest = parse(lines)
    total = count(lines)
    results = []

    if not items:
        results.append((False, "asks list", "no numbered list: put every ask in one numbered list under the opener"))
    else:
        words = count(opener)
        results.append((words <= OPENER_MAX, "opener", f"{words} words before the list (max {OPENER_MAX})"))

        tokens = re.findall(r"[a-z]+|\d+", " ".join(clean(line) for line in opener).lower())
        stated = {NUMBER_WORDS.index(t) + 1 for t in tokens if t in NUMBER_WORDS} | {int(t) for t in tokens if t.isdigit()}
        results.append((
            len(items) in stated,
            "ask count",
            f"the list has {len(items)} items"
            + ("" if len(items) in stated else f"; the opener does not say {len(items)} ({NUMBER_WORDS[len(items) - 1] if len(items) <= 12 else len(items)})"),
        ))

        longest = max(count(item) for item in items)
        results.append((longest <= ITEM_MAX, "item length", f"longest item {longest} words (max {ITEM_MAX})"))

        second = [line.strip() for line in rest if ITEM.match(line)]
        results.append((
            not second,
            "one list",
            "no second numbered list" if not second else f"numbered item after the list: {second[0][:70]!r}",
        ))

        asking = [
            clean(line).strip()
            for line in rest
            if not IMAGE.match(line) and not PLACEHOLDER.match(line) and REQUEST_WORDING.search(clean(line))
        ]
        results.append((
            not asking,
            "after the list",
            "statements only" if not asking else f"request wording outside the list: {asking[0][:70]!r}",
        ))

    after = units(rest if items else lines)
    longest = max((count(unit) for unit in after), default=0)
    results.append((
        longest <= PARAGRAPH_MAX,
        "paragraphs",
        f"longest paragraph or bullet {'after the list ' if items else ''}{longest} words (max {PARAGRAPH_MAX})",
    ))

    images = sum(1 for line in lines if IMAGE.match(line))
    placeholders = sum(1 for line in lines if PLACEHOLDER.match(line))
    if visual:
        results.append((
            images + placeholders > 0,
            "picture",
            f"{images} image line(s), {placeholders} placeholder line(s)"
            if images + placeholders
            else "no picture line: add a still or a [screenshot: ...] line, or pass --no-visual if nothing shows on a screen",
        ))

    results.append((total <= MESSAGE_MAX, "length", f"{total} words (max {MESSAGE_MAX})"))

    summary = []
    if items:
        known = count(opener) + sum(count(item) for item in items)
        summary.append(f"every ask is stated by word {known} of {total} ({100 * known // max(total, 1)}%)")
    if placeholders:
        summary.append(
            f"{placeholders} placeholder line(s): not ready to send until each is replaced by its picture"
        )
    return results, summary


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check a request message before handing it over.")
    parser.add_argument("message", type=Path)
    parser.add_argument("--no-visual", action="store_true", help="the work has no screen, so no picture is expected")
    args = parser.parse_args(argv)

    results, summary = check(args.message.read_text(), visual=not args.no_visual)
    print(f"request check: {args.message}")
    for passed, name, detail in results:
        print(f"  {'PASS' if passed else 'FAIL'}  {name:15s} {detail}")
    for line in summary:
        print(f"  note  {line}")
    ok = all(passed for passed, _, _ in results)
    print(f"RESULT: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
