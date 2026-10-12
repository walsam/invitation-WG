"""Inlines the monogram (with its writing-reveal masks) and the verified Qur'an/name strings into index.html.
Re-runnable: content between <!--X:start--> and <!--X:end--> markers is regenerated."""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
STRINGS = json.loads(pathlib.Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else json.loads((ROOT / "tools/strings.json").read_text())

def monogram():
    art = (ROOT / "assets/monogram.svg").read_text()
    reveal = (ROOT / "assets/monogram-reveal.svg").read_text()
    shapes = {m.group(1): m.group(2) for m in re.finditer(r'<path id="([^"]+)"[^>]*?\sd="([^"]+)"', art)}
    pens = []
    for m in re.finditer(r'<path ([^>]*?)\sd="([^"]+)"', reveal):
        attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
        pens.append((int(attrs["data-order"]), attrs["data-target"], float(attrs["data-len"]), attrs["stroke-width"], m.group(2)))
    pens.sort()
    masks = []
    for target in shapes:
        strokes = "".join(
            f'<path class="pen" data-order="{o}" data-len="{l:g}" pathLength="1" stroke-width="{w}" d="{d}"/>'
            for o, t, l, w, d in pens if t == target)
        masks.append(f'<mask id="m-{target}" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">'
                     f'<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">{strokes}</g></mask>')
    paths = "".join(f'<path d="{d}" mask="url(#m-{t})"/>' for t, d in shapes.items())
    return ('<svg class="monogram" data-reveal="pen" viewBox="0 0 1000 1000" role="img" aria-label="و غ">'
            '<defs><linearGradient id="mono-gold" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#f6dfaa"/><stop offset=".45" stop-color="#e4bb89"/>'
            '<stop offset=".7" stop-color="#c79c69"/><stop offset="1" stop-color="#9b7144"/></linearGradient>'
            + "".join(masks) + '</defs><g fill="url(#mono-gold)">' + paths + "</g></svg>")

def verse():
    words = STRINGS["verseUthmani"].split(" ")
    marker = STRINGS["ayahMarker"].replace(" ", "").strip()
    spans = "".join(f'<span class="w">{w}</span> ' for w in words[:-1])
    return spans + f'<span class="w">{words[-1]} <span class="verse__marker">{marker}</span></span>'

def thuluth(file, css_class, gradient_id):
    """Diwan Thuluth outlines (built by tools/build-names.py), filled with an embossed-gold gradient."""
    svg = (ROOT / "assets" / file).read_text()
    view_box = re.search(r'viewBox="([^"]+)"', svg).group(1)
    body = re.search(r"<g transform=\"scale\(1 -1\)\">.*</g>", svg, re.S).group(0)
    return (f'<svg class="{css_class}" viewBox="{view_box}" aria-hidden="true" focusable="false">'
            f'<defs><linearGradient id="{gradient_id}" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#fff4c8"/><stop offset=".3" stop-color="#f3d58e"/><stop offset=".55" stop-color="#c99a4c"/>'
            '<stop offset=".72" stop-color="#8a5d22"/><stop offset=".9" stop-color="#e9c477"/><stop offset="1" stop-color="#fff0bd"/></linearGradient></defs>'
            f'<g fill="url(#{gradient_id})">{body}</g></svg>')

blocks = {
    "MONOGRAM": monogram(),
    "BISMILLAH": STRINGS["bismillahUthmaniKashida"],
    "VERSE": verse(),
    "NAMES": thuluth("names.svg", "names__art", "names-gold"),
    "KICKER": thuluth("kicker.svg", "kicker__art", "kicker-gold"),
}

html = (ROOT / "index.html").read_text()
for key, value in blocks.items():
    pattern = re.compile(rf"<!--{key}:start-->.*?<!--{key}:end-->", re.S)
    if not pattern.search(html):
        sys.exit(f"marker {key} missing")
    html = pattern.sub(lambda _: f"<!--{key}:start-->{value}<!--{key}:end-->", html)
(ROOT / "index.html").write_text(html)
print("inlined", ", ".join(blocks))
