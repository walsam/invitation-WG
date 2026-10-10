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

blocks = {
    "MONOGRAM": monogram(),
    "BISMILLAH": STRINGS["bismillahUthmaniKashida"],
    "VERSE": verse(),
    "WALID": STRINGS["nameWalid"],
    "GHITA": STRINGS["nameGhita"],
}

html = (ROOT / "index.html").read_text()
for key, value in blocks.items():
    pattern = re.compile(rf"<!--{key}:start-->.*?<!--{key}:end-->", re.S)
    if not pattern.search(html):
        sys.exit(f"marker {key} missing")
    html = pattern.sub(lambda _: f"<!--{key}:start-->{value}<!--{key}:end-->", html)
(ROOT / "index.html").write_text(html)
print("inlined", ", ".join(blocks))
