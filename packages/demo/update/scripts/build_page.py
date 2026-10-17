#!/usr/bin/env python3
"""Build a paste-ready update page.

The page is one self-contained HTML file: the message, its screenshots inlined, and buttons that
copy the text, the text with screenshots, or one screenshot at a time.

    python3 build_page.py MESSAGE.md [--out PAGE.html] [--fragment] [--max-image-width 1600]

MESSAGE.md is a small Markdown subset (see SKILL.md). Image paths are relative to MESSAGE.md.
Standard library only (Python 3.8+). If Pillow is installed, screenshots wider than
--max-image-width are scaled down; without it they are embedded as they are.
"""

from __future__ import annotations

import argparse
import base64
import html
import io
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Union

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template.html"

IMAGE_LINE = re.compile(r"^!\[(?P<alt>[^\]]*)\]\((?P<src>[^)\s]+)(?:\s+\"(?P<title>[^\"]*)\")?\)\s*$")
LIST_ITEM = re.compile(r"^(?P<indent>\s*)(?P<marker>[-*+]|\d{1,9}[.)])\s+(?P<text>.*)$")
HEADING = re.compile(r"^(?P<hashes>#{1,6})\s+(?P<text>.+?)\s*#*\s*$")
SAFE_URL = re.compile(r"^(https?://|mailto:)", re.IGNORECASE)


class BuildError(Exception):
    pass


# --- Blocks -------------------------------------------------------------------------------------


@dataclass
class Paragraph:
    lines: List[str]


@dataclass
class Heading:
    level: int
    text: str


@dataclass
class Quote:
    lines: List[str]


@dataclass
class Figure:
    caption: str
    src: str
    number: int = 0


@dataclass
class Item:
    text: str
    children: Optional["ListBlock"] = None


@dataclass
class ListBlock:
    ordered: bool
    start: int
    items: List[Item] = field(default_factory=list)


Block = Union[Paragraph, Heading, Quote, Figure, ListBlock]


def split_front_matter(text: str):
    meta = {}
    lines = text.splitlines()
    if lines and lines[0].strip() == "---":
        for end in range(1, len(lines)):
            if lines[end].strip() == "---":
                for line in lines[1:end]:
                    if ":" in line:
                        key, value = line.split(":", 1)
                        key, value = key.strip().lower(), value.strip()
                        meta[key] = value
                        # `video:` may repeat: one player per video, in order.
                        if key == "video":
                            meta.setdefault("videos", []).append(value)
                return meta, lines[end + 1 :]
    return meta, lines


def parse_list(lines: List[str], i: int):
    """Parse a list starting at lines[i]; return (ListBlock, next index)."""
    first = LIST_ITEM.match(lines[i])
    base_indent = len(first.group("indent").expandtabs(4))
    ordered = first.group("marker")[0].isdigit()
    start = int(first.group("marker")[:-1]) if ordered else 1
    block = ListBlock(ordered=ordered, start=start)
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            # A blank line ends the list unless another item of this list follows.
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            nxt = LIST_ITEM.match(lines[j]) if j < len(lines) else None
            if nxt and len(nxt.group("indent").expandtabs(4)) >= base_indent:
                i = j
                continue
            break
        m = LIST_ITEM.match(line)
        indent = len(line) - len(line.lstrip()) if not m else len(m.group("indent").expandtabs(4))
        if m and indent == base_indent:
            if m.group("marker")[0].isdigit() != ordered:
                break
            block.items.append(Item(text=m.group("text").lstrip()))
            i += 1
        elif m and indent > base_indent and block.items:
            child, i = parse_list(lines, i)
            block.items[-1].children = child
        elif indent > base_indent and block.items and not IMAGE_LINE.match(line.strip()):
            block.items[-1].text += "\n" + line.lstrip()  # continuation line
            i += 1
        else:
            break
    return block, i


def parse(lines: List[str]) -> List[Block]:
    blocks: List[Block] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if IMAGE_LINE.match(stripped):
            m = IMAGE_LINE.match(stripped)
            blocks.append(Figure(caption=(m.group("title") or m.group("alt")).strip(), src=m.group("src")))
            i += 1
        elif HEADING.match(stripped):
            m = HEADING.match(stripped)
            blocks.append(Heading(level=2 if len(m.group("hashes")) <= 2 else 3, text=m.group("text")))
            i += 1
        elif LIST_ITEM.match(line):
            block, i = parse_list(lines, i)
            blocks.append(block)
        elif stripped.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].lstrip()[1:].lstrip())
                i += 1
            blocks.append(Quote(lines=quote))
        else:
            para = []
            while i < len(lines):
                s = lines[i].strip()
                if not s or IMAGE_LINE.match(s) or HEADING.match(s) or LIST_ITEM.match(lines[i]) or s.startswith(">"):
                    break
                para.append(lines[i].lstrip())
                i += 1
            blocks.append(Paragraph(lines=para))
    n = 0
    for block in blocks:
        if isinstance(block, Figure):
            n += 1
            block.number = n
    return blocks


# --- Inline text --------------------------------------------------------------------------------


CODE_SPAN = re.compile(r"(`[^`]+`)")
LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
BOLD = re.compile(r"\*\*(.+?)\*\*")
ITALIC_STAR = re.compile(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])")
ITALIC_UNDERSCORE = re.compile(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])")


def prose_lines(text: str) -> str:
    """Markdown soft wraps are spaces; two trailing spaces or backslash request a break."""
    lines = text.split("\n")
    out = []
    for i, line in enumerate(lines):
        has_next = i < len(lines) - 1
        slash_break = has_next and (len(line) - len(line.rstrip("\\"))) % 2 == 1
        hard = line.endswith("  ") or slash_break
        content = line[:-1] if slash_break else line
        out.append(content.rstrip())
        if i < len(lines) - 1:
            out.append("\n" if hard else " ")
    return "".join(out)


def inline_html(text: str) -> str:
    text = prose_lines(text)
    out = []
    for part in CODE_SPAN.split(text):
        if len(part) > 2 and part.startswith("`") and part.endswith("`"):
            out.append("<code>" + html.escape(part[1:-1]) + "</code>")
            continue
        s = html.escape(part)

        def link(m):
            url = html.unescape(m.group(2))
            if not SAFE_URL.match(url):
                return m.group(1)
            return '<a href="%s">%s</a>' % (html.escape(url), m.group(1))

        s = LINK.sub(link, s)
        s = BOLD.sub(r"<strong>\1</strong>", s)
        s = ITALIC_STAR.sub(r"<em>\1</em>", s)
        s = ITALIC_UNDERSCORE.sub(r"<em>\1</em>", s)
        out.append(s)
    return "<br>\n".join("".join(out).split("\n"))


def inline_plain(text: str) -> str:
    text = prose_lines(text)
    out = []
    for part in CODE_SPAN.split(text):
        if len(part) > 2 and part.startswith("`") and part.endswith("`"):
            out.append(part[1:-1])
            continue
        s = LINK.sub(lambda m: m.group(1) if m.group(1) == m.group(2) else "%s (%s)" % (m.group(1), m.group(2)), part)
        s = BOLD.sub(r"\1", s)
        s = ITALIC_STAR.sub(r"\1", s)
        s = ITALIC_UNDERSCORE.sub(r"\1", s)
        out.append(s)
    return "".join(out)


# --- Images -------------------------------------------------------------------------------------


def sniff_mime(data: bytes) -> Optional[str]:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def load_image(path: Path, max_width: int, warnings: List[str]):
    if not path.is_file():
        raise BuildError("screenshot not found: %s" % path)
    data = path.read_bytes()
    mime = sniff_mime(data)
    if not mime:
        raise BuildError("not a PNG, JPEG, GIF or WebP image: %s" % path)
    if max_width and mime in ("image/png", "image/jpeg", "image/webp"):
        try:
            from PIL import Image  # optional
        except ImportError:
            if len(data) > 1_500_000:
                warnings.append("%s is %.1f MB; install Pillow or crop it to keep the page small" % (path.name, len(data) / 1e6))
        else:
            with Image.open(io.BytesIO(data)) as im:
                if im.width > max_width:
                    height = round(im.height * max_width / im.width)
                    small = im.resize((max_width, height), Image.LANCZOS)
                    buf = io.BytesIO()
                    if mime == "image/jpeg":
                        small.convert("RGB").save(buf, "JPEG", quality=88)
                    else:
                        small.save(buf, "PNG", optimize=True)
                        mime = "image/png"
                    data = buf.getvalue()
    return "data:%s;base64,%s" % (mime, base64.b64encode(data).decode("ascii"))


# --- Rendering ----------------------------------------------------------------------------------


def render_list_html(block: ListBlock) -> str:
    tag = "ol" if block.ordered else "ul"
    start = ' start="%d"' % block.start if block.ordered and block.start != 1 else ""
    items = []
    for item in block.items:
        child = "\n" + render_list_html(item.children) if item.children else ""
        items.append("<li>%s%s</li>" % (inline_html(item.text), child))
    return "<%s%s>\n%s\n</%s>" % (tag, start, "\n".join(items), tag)


def render_list_plain(block: ListBlock, depth: int = 0) -> List[str]:
    lines = []
    for n, item in enumerate(block.items, start=block.start):
        marker = "%d. " % n if block.ordered else "• "
        pad = "   " * depth
        text_lines = inline_plain(item.text).split("\n")
        lines.append(pad + marker + text_lines[0])
        lines.extend(pad + " " * len(marker) + t for t in text_lines[1:])
        if item.children:
            lines.extend(render_list_plain(item.children, depth + 1))
    return lines


def render(blocks: List[Block], base: Path, max_width: int, warnings: List[str]):
    html_parts, plain_parts = [], []
    for block in blocks:
        if isinstance(block, Paragraph):
            html_parts.append("<p>%s</p>" % inline_html("\n".join(block.lines)))
            plain_parts.append(inline_plain("\n".join(block.lines)))
        elif isinstance(block, Heading):
            html_parts.append("<h%d>%s</h%d>" % (block.level, inline_html(block.text), block.level))
            plain_parts.append(inline_plain(block.text))
        elif isinstance(block, Quote):
            html_parts.append("<blockquote>%s</blockquote>" % inline_html("\n".join(block.lines)))
            plain_parts.append("\n".join("> " + l for l in inline_plain("\n".join(block.lines)).split("\n")))
        elif isinstance(block, ListBlock):
            html_parts.append(render_list_html(block))
            plain_parts.append("\n".join(render_list_plain(block)))
        elif isinstance(block, Figure):
            src = load_image((base / block.src).resolve(), max_width, warnings)
            caption = html.escape(block.caption)
            html_parts.append(
                '<figure class="shot" data-n="%d">\n'
                '  <img src="%s" alt="%s">\n'
                '  <figcaption><span>%s</span>'
                '<button type="button" class="copy-img">Copy image %d</button></figcaption>\n'
                "</figure>" % (block.number, src, caption or "Screenshot %d" % block.number, caption, block.number)
            )
    return "\n".join(html_parts), "\n\n".join(plain_parts).strip() + "\n"


def poster_of(path: Path) -> str:
    """A frame 1.5 s in, so a player whose video fades in from black does not sit black (needs ffmpeg)."""
    if shutil.which("ffmpeg") is None:
        return ""
    try:
        frame = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", "1.5", "-i", str(path), "-frames:v", "1", "-vf", "scale='min(960,iw)':-2",
             "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"],
            capture_output=True, check=True, timeout=60,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(frame).decode("ascii") if frame else ""


def video_block(meta, message_dir: Path, out_dir: Path, fragment: bool) -> str:
    """The videos (`video: path | label`, repeatable), shown on the page but never copied: a browser
    cannot copy a video, so the sender attaches each one."""
    entries = meta.get("videos") or []
    if not entries:
        return ""
    players = []
    for entry in entries:
        name, _, label = entry.partition("|")
        name, label = name.strip(), label.strip()
        path = (message_dir / name).resolve()
        if not path.is_file():
            raise BuildError("video not found: %s" % path)
        if path.suffix.lower() not in (".mp4", ".webm", ".mov"):
            raise BuildError("video must be .mp4, .webm or .mov: %s" % path)
        # A host that publishes the page with its files serves the video next to it, by name.
        src = path.name if fragment else Path(os.path.relpath(path, out_dir.resolve())).as_posix()
        # Hosts that wrap pages (the fragment case) also block download links, so offer one only locally.
        download = "" if fragment else ' <a href="%s" download>Download it</a>.' % html.escape(src)
        poster = poster_of(path)
        players.append(
            ("  <h3>%s</h3>\n" % html.escape(label) if label else "")
            + '  <video controls preload="metadata"%s src="%s"></video>\n'
            % (' poster="%s"' % poster if poster else "", html.escape(src))
            + '  <p class="note">Attach <code>%s</code> (%.1f MB) to the message yourself; a browser cannot copy a video.%s</p>\n'
            % (html.escape(path.name), path.stat().st_size / 1e6, download)
        )
    title = "Videos to attach" if len(players) > 1 else "Walkthrough video"
    return '<section class="sheet video">\n  <h2>%s</h2>\n%s</section>' % (title, "".join(players))


def build(message_path: Path, fragment: bool = False, max_width: int = 1600, out_path: Optional[Path] = None):
    text = message_path.read_text(encoding="utf-8")
    meta, lines = split_front_matter(text)
    blocks = parse(lines)
    warnings: List[str] = []
    message_html, plain = render(blocks, message_path.parent, max_width, warnings)
    figures = sum(isinstance(b, Figure) for b in blocks)

    title = meta.get("title") or "Paste-ready update"
    hint = meta.get("hint") or (
        "Copy text + screenshots pastes everything at once into email and documents. "
        "In chat apps, paste the text, then each screenshot with its Copy image button."
        if figures
        else "Copy the text and paste it where it is going."
    )
    template = TEMPLATE.read_text(encoding="utf-8")
    head, body = template.split("<!-- body -->", 1)
    head = head.replace("<!-- head -->", "").strip()
    values = {
        "{{TITLE}}": html.escape(title),
        "{{HINT}}": html.escape(hint),
        "{{MESSAGE}}": message_html,
        "{{PLAIN_JSON}}": json.dumps(plain, ensure_ascii=False).replace("</", "<\\/"),
        "{{RICH_BUTTON}}": "" if not figures else '<button type="button" id="copy-rich">Copy text + screenshots</button>',
        "{{VIDEO}}": video_block(meta, message_path.parent, (out_path or message_path).parent, fragment),
    }
    # One pass, so text inside the message that looks like a placeholder is never expanded.
    fill = re.compile("|".join(re.escape(k) for k in values))
    head = fill.sub(lambda m: values[m.group(0)], head)
    body = fill.sub(lambda m: values[m.group(0)], body)
    lang = html.escape(meta.get("lang") or "en")
    if fragment:
        page = head + "\n" + body.strip() + "\n"
    else:
        page = (
            '<!doctype html>\n<html lang="%s">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<meta name="generator" content="paste-ready-update">\n%s\n</head>\n<body>\n%s\n</body>\n</html>\n'
            % (lang, head, body.strip())
        )
    return page, plain, figures, warnings


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Build a paste-ready update page from MESSAGE.md.")
    parser.add_argument("message", type=Path, help="the message in Markdown (see SKILL.md)")
    parser.add_argument("--out", type=Path, help="output HTML path (default: MESSAGE with .html)")
    parser.add_argument("--fragment", action="store_true", help="omit <!doctype>/<html>/<head>/<body> for hosts that wrap pages")
    parser.add_argument("--max-image-width", type=int, default=1600, help="scale wider screenshots down when Pillow is installed (0 = never)")
    args = parser.parse_args(argv)
    out = args.out or args.message.with_suffix(".html")
    try:
        page, plain, figures, warnings = build(args.message, args.fragment, args.max_image_width, out)
    except (BuildError, OSError) as err:
        print("error: %s" % err, file=sys.stderr)
        return 1
    out.write_text(page, encoding="utf-8")
    words = len(re.findall(r"\w+", plain))
    print("wrote %s (%s): %d KB, %d screenshot%s, %d words%s" % (
        out, "fragment" if args.fragment else "document", len(page.encode()) // 1024, figures, "" if figures == 1 else "s", words,
        (", %d video%s" % (page.count("<video "), "" if page.count("<video ") == 1 else "s")) if "<video " in page else ""))
    for w in warnings:
        print("warning: %s" % w, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
