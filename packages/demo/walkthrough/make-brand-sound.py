#!/usr/bin/env python3
"""Write a brand card's opening sting: a warm major figure on soft bell tones over a low pad.

    python3 make-brand-sound.py <out.wav> [--key F3] [--seconds 2.8] [--voicing add9]
                                [--body 1.0] [--brightness 1.0] [--stagger 0.14]

Short and unhurried, to play once under a logo as it settles. The weight sits low: the figure is
played in the named octave rather than above it, a sub and a fifth hold underneath it, and the
last note is left ringing so the sting lands instead of trailing off. Bell-like rather than
synthetic: every note carries quiet harmonics, a second voice detuned a few cents for width, and
its own decay curve. Stdlib only, so the asset can be rebuilt and retuned without a toolchain.

The knobs are the ones worth turning by ear:
  --body        weight of the low pad and sub (0 none, 1 default, 2 heavy)
  --brightness  level of the upper partials (below 1 is rounder, above 1 is brighter and thinner)
  --voicing     triad | add9 | fifths — how open the figure sounds
  --stagger     seconds between notes; longer reads as more deliberate
"""

import argparse
import math
import struct
import wave

RATE = 48_000
# Equal temperament from A4, so a key is named rather than typed as a frequency.
SEMITONES = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
# How the figure climbs. A plain triad is a jingle; add9 is the warmer, less finished-sounding
# voicing a brand mark tends to want, and fifths are the most open.
VOICINGS = {"triad": (0, 4, 7, 12), "add9": (0, 7, 14, 16), "fifths": (0, 7, 12, 19)}
ATTACK_S = 0.012  # slower than a click, so the note blooms rather than taps
# Harmonic, relative level, scaled by --brightness above the first. A strong second with a
# restrained third and fourth gives body; a bare sine reads as a test tone, and a loud third
# reads as thin and glassy.
HARMONICS = ((1, 1.0), (2, 0.42), (3, 0.14), (4, 0.05))
DETUNE_CENTS = 6.0  # a second voice this far off beats slowly and widens the note
PEAK = 0.5  # about -6 dBFS, so the renderer still has room to duck it under narration


def note_hz(name: str) -> float:
    letter, accidental, octave = name[0].upper(), 0, int(name[-1])
    if "#" in name:
        accidental = 1
    elif "b" in name:
        accidental = -1
    return 440.0 * 2 ** ((SEMITONES[letter] + accidental + 12 * (octave - 4)) / 12)


def envelope(t: float, tau: float) -> float:
    """Soft attack, exponential decay. The attack keeps the note from clicking."""
    if t < 0:
        return 0.0
    return min(1.0, t / ATTACK_S) * math.exp(-t / tau)


def bell(t: float, hz: float, tau: float, brightness: float) -> float:
    shaped = envelope(t, tau)
    if shaped <= 0:
        return 0.0
    tone = 0.0
    for partial, level in HARMONICS:
        weight = level if partial == 1 else level * brightness
        if weight <= 0:
            continue
        for cents in (-DETUNE_CENTS / 2, DETUNE_CENTS / 2):
            tone += weight * 0.5 * math.sin(2 * math.pi * hz * partial * 2 ** (cents / 1200) * t)
    return shaped * tone


def render(key: str, seconds: float, voicing: str, body: float, brightness: float, stagger: float):
    root = note_hz(key)  # the figure sits in the named octave: the weight stays low
    steps = VOICINGS[voicing]
    notes = [(i * stagger, root * 2 ** (s / 12)) for i, s in enumerate(steps)]
    # The pad: a sub an octave under the key, the key itself, and its fifth. This is the body the
    # ear reads as "a brand", rather than a chime.
    pad = ((root / 2, 1.0), (root, 0.55), (root * 2 ** (7 / 12), 0.35))
    frames: list[tuple[float, float]] = []
    for n in range(int(seconds * RATE)):
        t = n / RATE
        left = right = 0.0
        for i, (start, hz) in enumerate(notes):
            last = i == len(notes) - 1
            # Higher notes ring shorter, as a struck bar does; the last one is left to land.
            tau = 1.5 if last else 0.95 - 0.06 * i
            voice = bell(t - start, hz, tau, brightness)
            # A touch of stereo: the climb opens outward from the centre.
            spread = 0.5 + 0.11 * (i - (len(notes) - 1) / 2)
            left += voice * (1 - spread)
            right += voice * spread
        swell = min(1.0, t / 0.35) * math.exp(-t / 2.2) * 0.34 * body
        for hz, level in pad:
            tone = swell * level * math.sin(2 * math.pi * hz * t)
            left += tone
            right += tone
        # Leave before the card does, so the cut to the walkthrough is silent.
        out = max(0.0, min(1.0, (seconds - t) / 0.5))
        frames.append((left * out, right * out))
    return frames


def write(path: str, frames: list[tuple[float, float]]) -> None:
    loudest = max((max(abs(l), abs(r)) for l, r in frames), default=1.0) or 1.0
    gain = PEAK / loudest
    packed = b"".join(
        struct.pack("<hh", int(l * gain * 32767), int(r * gain * 32767)) for l, r in frames
    )
    with wave.open(path, "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(packed)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out")
    parser.add_argument("--key", default="F3", help="root of the figure (default F3, warm)")
    parser.add_argument("--seconds", type=float, default=2.8)
    parser.add_argument("--voicing", choices=sorted(VOICINGS), default="add9")
    parser.add_argument("--body", type=float, default=1.0, help="weight of the low pad and sub")
    parser.add_argument("--brightness", type=float, default=1.0, help="level of the upper partials")
    parser.add_argument("--stagger", type=float, default=0.14, help="seconds between notes")
    args = parser.parse_args()
    write(
        args.out,
        render(args.key, args.seconds, args.voicing, args.body, args.brightness, args.stagger),
    )
    print(
        f"{args.out}: {args.seconds:g}s {args.key} {args.voicing}, body {args.body:g}, "
        f"brightness {args.brightness:g}, stagger {args.stagger:g}s, peak {PEAK:.2f}"
    )


if __name__ == "__main__":
    main()
