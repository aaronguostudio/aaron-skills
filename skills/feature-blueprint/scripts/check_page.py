#!/usr/bin/env python3
"""Check a Shape proposal page as its receiver first sees it. Standard library only.

    python3 check_page.py PAGE.html

Reads the page with every script removed and every disclosure closed, which is
how a static viewer shows it, and checks the reading surface described in
SKILL.md. Exit status 0 when every check passes, 1 when one fails. It does not
judge meaning, and it does not replace looking at the page in a browser.
"""
import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

PRESETS = {
    "feature": ["Requirements", "Operating model", "Prototype", "Data model", "Next steps"],
    "system": ["Requirements", "Operating model", "Before and after", "How the pieces fit", "Next steps"],
    "process": ["Requirements", "Operating model", "Before and after", "Who does what", "Next steps"],
}
LIST_SECTIONS = ("Requirements", "Next steps")
# An inline marker such as <span class="tag">Owner: release lead</span> counts as words, not as a sentence.
ITEM_MAX = 25
SURFACE_MAX = 600
SECTION_MIN = 15
FRAME_MIN = 5
CONTAINERS = {"div", "section", "article", "tbody", "ul", "ol", "dl", "figure"}
MEDIA = {"img", "svg", "canvas", "video", "picture", "input", "select", "textarea", "iframe", "output"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self, skip=lambda node: False):
        if skip(self):
            return ""
        parts = []
        for child in self.children:
            parts.append(child if isinstance(child, str) else child.text(skip))
        return " ".join(parts)

    def walk(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.walk()

    def inside(self, tag):
        node = self.parent
        while node is not None:
            if node.tag == tag:
                return True
            node = node.parent
        return False


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [], None)
        self.current = self.root
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if self.skip_depth or tag in ("script", "style", "template", "noscript"):
            self.skip_depth += tag not in VOID
            return
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        if not self.skip_depth:
            self.current.children.append(Node(tag, attrs, self.current))

    def handle_endtag(self, tag):
        if self.skip_depth:
            self.skip_depth -= tag not in VOID
            return
        node = self.current
        while node is not self.root and node.tag != tag:
            node = node.parent
        if node is not self.root:
            self.current = node.parent

    def handle_data(self, data):
        if not self.skip_depth and data.strip():
            self.current.children.append(data)


def words(text):
    return len(text.split())


def summary_text(node):
    """Text of a disclosure that is visible while it is closed: its summary."""
    summary = next((c for c in node.children if isinstance(c, Node) and c.tag == "summary"), None)
    return summary.text() if summary else ""


def closed(node):
    """Text with disclosures closed: a details element shows only its summary."""
    return node.text(skip=lambda n: n.tag == "details") + " " + " ".join(
        summary_text(d) for d in node.walk() if d.tag == "details" and not d.inside("details")
    )


def sentences(text):
    text = re.sub(r"\b(e\.g|i\.e|vs|etc|No)\.", "", text)
    return len([s for s in re.split(r"[.!?](?:\s|$)", text.strip()) if s.strip()])


def check(raw):
    tree = Tree()
    tree.feed(raw)
    nodes = list(tree.root.walk())
    sections = [n for n in nodes if n.tag == "section" and "data-shape-section" in n.attrs]
    results = []

    labels = [s.attrs["data-shape-section"] for s in sections]
    headings = [" ".join(next((c.text() for c in s.walk() if c.tag == "h2"), "").split()) for s in sections]
    nav = next((n for n in nodes if "data-section-nav" in n.attrs), None)
    nav_labels = [" ".join(a.text().split()) for a in nav.walk() if a.tag == "a"] if nav else []
    preset = next((name for name, value in PRESETS.items() if value == labels), None)
    results.append((
        preset is not None and headings == labels and nav_labels == labels,
        "sections",
        f"preset '{preset}'" if preset and headings == labels and nav_labels == labels
        else f"sections {labels}, headings {headings}, navigation {nav_labels}; use one preset from SKILL.md, in order, with matching headings and navigation",
    ))

    thin = [label for label, s in zip(labels, sections) if words(s.text()) - words(label) < SECTION_MIN]
    results.append((not thin, "scripts off", "every section has content without scripts" if not thin
                    else f"empty or near-empty without scripts: {', '.join(thin)}"))

    empty = []
    in_main = [n for n in nodes if n.inside("main")]
    for n in in_main:
        name = n.attrs.get("data-title") or n.attrs.get("id") or next(
            (f"[{k}]" for k in n.attrs if k.startswith("data-")), n.tag)
        if "data-canvas-page" in n.attrs or "data-frame" in n.attrs:
            if words(n.text()) < FRAME_MIN:
                empty.append(f"frame {name}")
        elif n.tag in CONTAINERS and not n.text().strip() and not any(c.tag in MEDIA for c in n.walk()):
            empty.append(f"empty {n.tag} {name}")
        elif n.tag == "table" and not any(c.tag == "td" for c in n.walk()):
            empty.append(f"table {name}")
        elif n.tag == "svg" and not any(c.tag == "text" for c in n.walk()):
            empty.append(f"diagram {name}")
    results.append((not empty, "static content", "frames, tables and diagrams have content in the HTML" if not empty
                    else f"filled only by script: {', '.join(empty[:4])}"))

    long_items = []
    for label, s in zip(labels, sections):
        if label not in LIST_SECTIONS:
            continue
        for li in s.walk():
            if li.tag != "li" or li.inside("details") or li.parent.inside("li"):
                continue
            visible = li.text(skip=lambda n: n.tag == "details")
            prose = li.text(skip=lambda n: n.tag == "details" or "tag" in n.attrs.get("class", "").split())
            if words(visible) > ITEM_MAX or sentences(prose) > 1:
                long_items.append(f"{label}: {' '.join(visible.split())[:60]!r}")
    results.append((not long_items, "one line each", f"every {' and '.join(LIST_SECTIONS)} item is one sentence of at most {ITEM_MAX} words"
                    if not long_items else f"{len(long_items)} item(s) longer than one line, first {long_items[0]}"))

    paragraphs = [label for label, s in zip(labels, sections) if label in LIST_SECTIONS and any(
        c.tag == "p" and not c.inside("details") and words(c.text()) > ITEM_MAX for c in s.walk())]
    results.append((not paragraphs, "no prose blocks", f"no paragraph over {ITEM_MAX} words in {' or '.join(LIST_SECTIONS)}"
                    if not paragraphs else f"paragraph over {ITEM_MAX} words outside a disclosure in: {', '.join(paragraphs)}"))

    surface = sum(words(closed(s)) for s in sections)
    results.append((surface <= SURFACE_MAX, "surface", f"{surface} words with disclosures closed (max {SURFACE_MAX})"))
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check a Shape proposal page with scripts off and disclosures closed.")
    parser.add_argument("page", type=Path)
    args = parser.parse_args(argv)
    results = check(args.page.read_text(encoding="utf-8"))
    print(f"page check: {args.page}")
    for passed, name, detail in results:
        print(f"  {'PASS' if passed else 'FAIL'}  {name:16s} {detail}")
    ok = all(passed for passed, _, _ in results)
    print(f"RESULT: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
