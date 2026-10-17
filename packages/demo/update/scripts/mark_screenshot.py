#!/usr/bin/env python3
"""Crop a screenshot and mark what the reader should click. Needs Pillow (pip install pillow).

    python3 mark_screenshot.py IN.png --info
    python3 mark_screenshot.py IN.png OUT.png [--crop x0,y0,x1,y1] [--box x0,y0,x1,y1[:label]] ...
    python3 mark_screenshot.py IN.png OUT.png --steps steps.json --step ID [--label N] [--crop auto]

All coordinates are pixels of the ORIGINAL image (use --info for its size), so --crop can change
without moving the boxes. Each --box draws a red rectangle; a label (for example 1, 2, 3) is drawn
in a red badge to the left of the box, matching the step numbers in the message.

With a walkthrough capture folder, --steps/--step mark the element the step clicks first, from
the recorded click box (viewport px, scaled to the image using the capture.json beside
steps.json), and --crop auto frames it with some context. No coordinates to guess. A step's shot
is taken before its first click, so later clicks (inside a dialog that opens) are not on it;
--click all marks them anyway, for a step whose clicks all stay on one screen.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RED = (217, 45, 32)


def parse_rect(text: str):
    label = None
    if ":" in text:
        text, label = text.split(":", 1)
    parts = [int(round(float(p))) for p in text.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("expected x0,y0,x1,y1 but got %r" % text)
    x0, y0, x1, y1 = parts
    if x1 <= x0 or y1 <= y0:
        raise argparse.ArgumentTypeError("x1,y1 must be right of and below x0,y0: %r" % text)
    return (x0, y0, x1, y1), label


def font(size):
    from PIL import ImageFont

    for path in ("/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def mark(src, dst, crop=None, boxes=()):
    from PIL import Image, ImageDraw

    with Image.open(src) as opened:
        im = opened.convert("RGB")
    ox, oy = 0, 0
    if crop:
        (x0, y0, x1, y1), _ = crop
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(im.width, x1), min(im.height, y1)
        im = im.crop((x0, y0, x1, y1))
        ox, oy = x0, y0
    draw = ImageDraw.Draw(im)
    stroke = max(2, round(min(im.width, im.height) / 250))
    radius = max(10, stroke * 5)
    for (x0, y0, x1, y1), label in boxes:
        x0, y0, x1, y1 = x0 - ox, y0 - oy, x1 - ox, y1 - oy
        pad = stroke + 1
        draw.rounded_rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), radius=stroke * 2, outline=RED, width=stroke)
        if label:
            cx = max(radius, x0 - pad - radius - stroke * 2)
            cy = (y0 + y1) / 2
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=RED)
            draw.text((cx, cy), label, fill="white", font=font(round(radius * 1.2)), anchor="mm")
    im.save(dst)
    return im.size


def boxes_from_steps(steps_path, step_id, label, image_width, which="first"):
    """Boxes (in image px) for the step's first click, or for all of them."""
    steps = json.loads(Path(steps_path).read_text(encoding="utf-8"))
    step = next((s for s in steps if s.get("id") == step_id), None)
    if step is None:
        raise ValueError("no step %r in %s" % (step_id, steps_path))
    scale = 1.0
    capture = Path(steps_path).with_name("capture.json")
    if capture.is_file():
        viewport_w = json.loads(capture.read_text(encoding="utf-8")).get("viewport", {}).get("w")
        if viewport_w:
            scale = image_width / viewport_w
    boxes = []
    clicks = step.get("clicks") or []
    for click in clicks if which == "all" else clicks[:1]:
        b = click.get("box") or {"x": click["x"] - 20, "y": click["y"] - 20, "w": 40, "h": 40}
        rect = tuple(round(v * scale) for v in (b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]))
        boxes.append((rect, label))
    return boxes


def auto_crop(boxes, size, margin=200, min_size=(760, 475)):
    """A crop around the boxes with context, at least min_size, kept inside the image."""
    if not boxes:
        return None
    width, height = size
    x0 = min(b[0][0] for b in boxes) - margin
    y0 = min(b[0][1] for b in boxes) - margin
    x1 = max(b[0][2] for b in boxes) + margin
    y1 = max(b[0][3] for b in boxes) + margin
    for lo, hi, need, limit in ((0, 2, min_size[0], width), (1, 3, min_size[1], height)):
        rect = [x0, y0, x1, y1]
        short = need - (rect[hi] - rect[lo])
        if short > 0:
            rect[lo] -= short // 2
            rect[hi] += short - short // 2
        shift = max(0, -rect[lo]) - max(0, rect[hi] - limit)
        rect[lo], rect[hi] = max(0, rect[lo] + shift), min(limit, rect[hi] + shift)
        x0, y0, x1, y1 = rect
    return ((x0, y0, x1, y1), None)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Crop a screenshot and mark what to click.")
    parser.add_argument("src")
    parser.add_argument("dst", nargs="?")
    parser.add_argument("--info", action="store_true", help="print the image size and exit")
    parser.add_argument("--crop", help="x0,y0,x1,y1 in original pixels, or auto (around the boxes)")
    parser.add_argument("--box", type=parse_rect, action="append", default=[], help="x0,y0,x1,y1[:label], repeatable")
    parser.add_argument("--steps", help="steps.json of a walkthrough capture folder")
    parser.add_argument("--step", help="the step id whose clicks to mark (with --steps)")
    parser.add_argument("--label", help="badge text for the --steps boxes, usually the message step number")
    parser.add_argument("--click", choices=["first", "all"], default="first", help="with --steps: the first click (default) or all")
    args = parser.parse_args(argv)
    if bool(args.steps) != bool(args.step):
        parser.error("--steps and --step go together")
    try:
        from PIL import Image
    except ImportError:
        print("error: Pillow is not installed (pip install pillow); use the screenshot unmarked instead", file=sys.stderr)
        return 2
    if args.info:
        with Image.open(args.src) as im:
            print("%dx%d" % im.size)
        return 0
    if not args.dst:
        parser.error("OUT is required unless --info is given")
    boxes = list(args.box)
    if args.steps:
        with Image.open(args.src) as im:
            size = im.size
        try:
            boxes += boxes_from_steps(args.steps, args.step, args.label, size[0], args.click)
        except (ValueError, KeyError, OSError) as err:
            print("error: %s" % err, file=sys.stderr)
            return 1
    else:
        with Image.open(args.src) as im:
            size = im.size
    if args.crop == "auto":
        crop = auto_crop(boxes, size)
    elif args.crop:
        crop = parse_rect(args.crop)
    else:
        crop = None
    width, height = mark(args.src, args.dst, crop, boxes)
    print("wrote %s (%dx%d)" % (args.dst, width, height))
    return 0


if __name__ == "__main__":
    sys.exit(main())
