"""Builds assets/names.svg («وليد و غيثة») and assets/kicker.svg («حفل عقد قران»), set in Diwan Thuluth and converted to outlines.

Diwan Thuluth ships with macOS only, so the names are shipped as vector paths (no font file is
distributed) and render identically on every phone. Needs: pip install uharfbuzz fonttools.
Usage: python3 tools/build-names.py   (then python3 tools/inline.py)"""
import pathlib
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT = "/System/Library/Fonts/Supplemental/Diwan Thuluth.ttf"
ROOT = pathlib.Path(__file__).resolve().parent.parent
PIECES = {
    "names.svg": [("وليد", 1.0), ("و", 0.6), ("غيثة", 1.0)],  # (text, scale) — the small و joins the names, as in the chosen sample
    "kicker.svg": [("حفل", 1.0), ("عقد", 1.0), ("قران", 1.0)],
}
GAP = 0.19  # space between words, in em

blob = hb.Blob.from_file_path(FONT)
face = hb.Face(blob)
font = hb.Font(face)
upem = face.upem
tt = TTFont(FONT)
glyph_set = tt.getGlyphSet()
order = tt.getGlyphOrder()

def shape(text):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {})
    return buf.glyph_infos, buf.glyph_positions

def build(words, out):
    # Lay the words out right to left: the first word sits at the right.
    paths, cursor = [], 0.0
    bounds = BoundsPen(glyph_set)
    for text, scale in words:
        infos, positions = shape(text)
        width = sum(p.x_advance for p in positions) * scale
        x = cursor - width  # this word occupies [cursor - width, cursor]
        pen_x = x
        word = SVGPathPen(glyph_set)
        for info, pos in zip(infos, positions):
            name = order[info.codepoint]
            # font units, y up → flipped in the SVG
            transform = (scale, 0, 0, scale, pen_x + pos.x_offset * scale, pos.y_offset * scale)
            glyph_set[name].draw(TransformPen(word, transform))
            glyph_set[name].draw(TransformPen(bounds, transform))
            pen_x += pos.x_advance * scale
        paths.append(word.getCommands())
        cursor = x - GAP * upem

    x0, y0, x1, y1 = bounds.bounds
    pad = 0.04 * upem
    vb = (x0 - pad, -(y1 + pad), (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.0f} {vb[1]:.0f} {vb[2]:.0f} {vb[3]:.0f}" fill="currentColor">'
           f'<g transform="scale(1 -1)">' + "".join(f'<path d="{d}"/>' for d in paths) + "</g></svg>\n")
    (ROOT / "assets" / out).write_text(svg)
    print(f"assets/{out}  viewBox {vb[2]:.0f}x{vb[3]:.0f}  aspect {vb[2] / vb[3]:.2f}  {len(svg) // 1024} KB")

for out, words in PIECES.items():
    build(words, out)
