"""Cache-busting: adds ?v=<content hash> to every local file the page loads, so browsers always fetch
changed files instead of reusing old copies. Re-run after any change: python3 tools/stamp.py

Order matters: files referenced inside audio.js / styles.css / fonts.css are stamped first, so those
files' own hashes (stamped into index.html) change whenever anything they point to changes."""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCAL = r"(?!https?:|data:|#|mailto:)"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def stamp(text, base, pattern):
    """Rewrite each local reference matched by `pattern` (group 'url') to url?v=<hash of that file>."""
    def replace(match):
        url = match.group("url")
        clean = url.split("?", 1)[0]
        target = (base / clean).resolve()
        if not target.is_file():
            return match.group(0)
        start, end = match.span("url")
        offset = match.start(0)
        whole = match.group(0)
        return whole[:start - offset] + f"{clean}?v={digest(target)}" + whole[end - offset:]
    return re.sub(pattern, replace, text)


def rewrite(path, *patterns):
    text = path.read_text()
    for pattern in patterns:
        text = stamp(text, path.parent, pattern)
    path.write_text(text)


QUOTED_PATH = LOCAL + r"(?P<url>[\w./-]+\.(?:m4a|webp|svg|woff2|css|js|ics)(?:\?v=[0-9a-f]+)?)"
CSS_URL = r"url\(\"?" + QUOTED_PATH
JS_STRING = r"\"" + QUOTED_PATH + r"\""
HTML_ATTR = r"(?:src|href)=\"" + QUOTED_PATH + r"\""

rewrite(ROOT / "audio.js", JS_STRING)
rewrite(ROOT / "assets/fonts.css", r"url\(" + QUOTED_PATH)
rewrite(ROOT / "styles.css", CSS_URL)
rewrite(ROOT / "index.html", HTML_ATTR)
print("stamped audio.js, assets/fonts.css, styles.css, index.html")
