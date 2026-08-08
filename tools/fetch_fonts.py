import re, os, urllib.request, pathlib
UA = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
OUT = pathlib.Path("static/fonts"); OUT.mkdir(parents=True, exist_ok=True)
WANT = {"cyrillic","cyrillic-ext","latin","latin-ext"}

specs = [
    ("cormorant", "https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap"),
    ("ptserif",   "https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap"),
]

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()

css_out = []
for name, url in specs:
    css = get(url).decode("utf-8")
    blocks = re.findall(r"(/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{.*?\})", css, re.S)
    kept = 0
    for block, subset in blocks:
        if subset not in WANT: continue
        m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not m: continue
        furl = m.group(1)
        style = "italic" if "font-style: italic" in block else "normal"
        wm = re.search(r"font-weight:\s*(\d+)", block); weight = wm.group(1) if wm else "400"
        fname = f"{name}-{weight}-{'i' if style=='italic' else 'n'}-{subset}.woff2"
        p = OUT / fname
        if not p.exists():
            p.write_bytes(get(furl))
        newblock = block.split("*/",1)[1].replace(furl, f"../fonts/{fname}")
        # keep unicode-range
        css_out.append(f"/* {name} {weight} {style} {subset} */" + newblock)
        kept += 1
    print(f"{name}: {kept} faces")

pathlib.Path("static/css/fonts.css").write_text(
    "/* Шрифты лежат в репозитории — сайт не зависит от Google Fonts. */\n" + "\n".join(css_out) + "\n",
    encoding="utf-8")
total = sum(f.stat().st_size for f in OUT.glob("*.woff2"))
print(f"files={len(list(OUT.glob('*.woff2')))} total={total/1024:.0f} KB")
