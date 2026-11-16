"""Bundle Scopoli · MAM04 into one self-contained HTML file for Canvas Files.

    python3 prepare/build_single.py      # writes dist/scopoli-mam04.html

Stylesheets and scripts referenced from index.html are inlined, so the page
works without its neighbours (Canvas rewrites or breaks relative links).
It still needs internet access to query DBpedia and Wikidata.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text()

def css(m):
    href = re.search(r'href="([^"]+)"', m.group(0)).group(1)
    if href.startswith("http"):
        return ""  # web fonts: optional, the page falls back to system fonts
    return "<style>\n" + (ROOT / href).read_text() + "\n</style>"

def js(m):
    code = (ROOT / m.group(1)).read_text().replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"

html = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", html)
html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*>', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
assert 'src="' not in html.split("<body>")[0] and "vendor/" not in html, "something was not inlined"

out = ROOT / "dist" / "scopoli-mam04.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")
