#!/usr/bin/env python3
"""
Builds The Guesser's buzzer artwork as static SVGs with all type converted to outlines, so the
files render the same everywhere (img tags, link previews, no web fonts needed).

Outputs:
  public/games/the-guesser.svg          1200x500, the /games card cover (2.4:1)
  public/games/the-guesser-og.svg       1200x630, the Open Graph and Twitter source
  public/games/the-guesser-band.svg     1200x900 (4:3), the home page band

Needs: pip install fonttools brotli. Fonts: Archivo Black (this folder) and Archivo Regular
(public/crest/fonts). Run from the repo root: python3 scripts/guesser-art/build.py
Brand: navy #0A111F, cream #F2EDE4, signal red #D8232A (the buzzer and the "?" only).
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

NAVY, CREAM, RED = "#0A111F", "#F2EDE4", "#D8232A"
BLACK = TTFont("scripts/guesser-art/archivo-black-latin.woff2")
REGULAR = TTFont("public/crest/fonts/archivo-latin-400-normal.woff2")


def width(font, text, size, tracking=0.0):
    cmap, hmtx, upm = font.getBestCmap(), font["hmtx"], font["head"].unitsPerEm
    total = sum(hmtx[cmap[ord(c)]][0] for c in text) * size / upm
    return total + tracking * size * (len(text) - 1)


def text(font, s, size, x, baseline, fill, anchor="middle", tracking=0.0):
    """Outlined text. anchor: start | middle | end."""
    gs, cmap, hmtx, upm = font.getGlyphSet(), font.getBestCmap(), font["hmtx"], font["head"].unitsPerEm
    w = width(font, s, size, tracking)
    pen_x = x - (w / 2 if anchor == "middle" else w if anchor == "end" else 0)
    k = size / upm
    out = []
    for ch in s:
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        gs[name].draw(TransformPen(pen, (k, 0, 0, -k, pen_x, baseline)))
        d = pen.getCommands()
        if d:
            out.append(d)
        pen_x += hmtx[name][0] * k + tracking * size
    return f'<path fill="{fill}" d="{" ".join(out)}"/>'


def art(cx=600, scale=1.0, dy=0):
    """Silhouette, four cylinders, buzzer. Drawn in a 1200x630 frame, centred on cx, y 120 to 522."""
    p = []
    # Cream player silhouette: head and shoulders.
    p.append(f'<circle cx="{cx}" cy="148" r="28" fill="{CREAM}"/>')
    p.append(
        f'<path fill="{CREAM}" d="M{cx-68} 250 C{cx-68} 205 {cx-40} 188 {cx} 188 '
        f'C{cx+40} 188 {cx+68} 205 {cx+68} 250 Z"/>'
    )
    p.append(text(BLACK, "?", 44, cx, 238, RED))
    # Four cylinders, 4 half drained from the top.
    w, h, gap, y0, rx = 70, 96, 22, 272, 22
    x0 = cx - (4 * w + 3 * gap) / 2
    defs = []
    for i, label in enumerate(["4", "3", "2", "1"]):
        x = x0 + i * (w + gap)
        cid = f"tube{i}"
        defs.append(f'<clipPath id="{cid}"><rect x="{x}" y="{y0}" width="{w}" height="{h}" rx="{rx}"/></clipPath>')
        p.append(f'<rect x="{x}" y="{y0}" width="{w}" height="{h}" rx="{rx}" fill="{CREAM}"/>')
        if i == 0:
            p.append(f'<rect x="{x}" y="{y0}" width="{w}" height="{h/2}" fill="{NAVY}" clip-path="url(#{cid})"/>')
        p.append(f'<rect x="{x+2}" y="{y0+2}" width="{w-4}" height="{h-4}" rx="{rx-2}" fill="none" stroke="{CREAM}" stroke-width="4"/>')
        p.append(text(BLACK, label, 28, x + w / 2, y0 + h + 34, CREAM))
    # Red circular buzzer with a cream ring.
    by = 478
    p.append(f'<circle cx="{cx}" cy="{by}" r="52" fill="none" stroke="{CREAM}" stroke-width="3"/>')
    p.append(f'<circle cx="{cx}" cy="{by}" r="44" fill="{RED}"/>')
    p.append(text(BLACK, "BUZZ", 22, cx, by + 8, CREAM, tracking=0.04))
    g = f'<g transform="translate({(1-scale)*cx:.2f} {dy}) scale({scale})">' + "".join(p) + "</g>"
    return "<defs>" + "".join(defs) + "</defs>" + g


def svg(w, h, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
        f'aria-label="{title}"><title>{title}</title><rect width="{w}" height="{h}" fill="{NAVY}"/>{body}</svg>\n'
    )


TITLE = "The Guesser. Five players. Twenty points. Beat the clock."
TAGLINE = "Five players. Twenty points. Beat the clock."

# Open Graph, 1200x630: everything centred. Safe margin 48.
og = (
    text(BLACK, "THE GUESSER", 64, 600, 98, CREAM, tracking=0.03)
    + art(600)
    + text(REGULAR, TAGLINE, 28, 600, 588, CREAM)
)
open("public/games/the-guesser-og.svg", "w").write(svg(1200, 630, og, TITLE))

# Card, 1200x500 (2.4:1): art centred, title left, tagline right. Safe margin 90 left and right.
scale = 0.86
dy = (500 - (522 - 120) * scale) / 2 - 120 * scale + 2
card = (
    art(600, scale, dy)
    + text(BLACK, "THE", 56, 96, 216, CREAM, "start", 0.03)
    + text(BLACK, "GUESSER", 56, 96, 278, CREAM, "start", 0.03)
    + text(REGULAR, "Five players.", 40, 1104, 196, CREAM, "end")
    + text(REGULAR, "Twenty points.", 40, 1104, 246, CREAM, "end")
    + text(REGULAR, "Beat the clock.", 40, 1104, 296, CREAM, "end")
)
open("public/games/the-guesser.svg", "w").write(svg(1200, 500, card, TITLE))

for name, size, base, sizes in [("Title", 64, "GUESSER", None)]:
    print("GUESSER width", round(width(BLACK, base, size, 0.03)))
print("Twenty points. width", round(width(REGULAR, "Twenty points.", 40)))
print("tagline og width", round(width(REGULAR, TAGLINE, 28)))
print("title og width", round(width(BLACK, "THE GUESSER", 64, 0.03)))

# Home band, 1200x900 (4:3): the Open Graph stack scaled up and centred. Content stays 140px+ from every edge.
k = 1.15
dyb = (900 - 630 * k) / 2
band = f'<g transform="translate({600 * (1 - k):.2f} {dyb:.2f}) scale({k})">{og}</g>'
open("public/games/the-guesser-band.svg", "w").write(svg(1200, 900, band, TITLE))
