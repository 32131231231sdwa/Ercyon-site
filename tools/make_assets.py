# -*- coding: utf-8 -*-
"""Готовит все картинки сайта из исходников автора.
Запуск (не обязателен для сборки сайта, всё уже лежит в static/img):
    python3 tools/make_assets.py
"""
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

SRC = pathlib.Path("/agent/stored_files")
LOGO = SRC / "cmsksw2ev0rkk06ad6776hoym_____.jpg"
FOREST = SRC / "cmskt0h2n0s9m06adkoc27ubo____.jpg"
KNIGHT = SRC / "cmskt0h2p0pwh06ad8f7db8u6____ ___ ____.png"
OUT = pathlib.Path("static/img"); OUT.mkdir(parents=True, exist_ok=True)

DEEP = (0x14, 0x35, 0x2A)
MOSS = (0x3E, 0x6B, 0x4F)
GOLD = (0xB0, 0x8D, 0x4A)


def save_webp(im, name, q=82, **kw):
    p = OUT / name
    im.save(p, "WEBP", quality=q, method=6, **kw)
    print(f"  {name:34s} {p.stat().st_size/1024:7.1f} KB  {im.size[0]}x{im.size[1]}")


def save_png(im, name, **kw):
    p = OUT / name
    im.save(p, "PNG", optimize=True, **kw)
    print(f"  {name:34s} {p.stat().st_size/1024:7.1f} KB  {im.size[0]}x{im.size[1]}")


# ─────────────────────────────────────────────── ЛОГОТИП
def build_logo():
    print("Логотип:")
    im = Image.open(LOGO).convert("RGB")
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2,
                  (im.width + s) // 2, (im.height + s) // 2)).resize((1024, 1024), Image.LANCZOS)

    # круглая маска с мягким краем — эмблема занимает ~96% кадра
    mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(mask).ellipse((6, 6, 1017, 1017), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))

    # чуть поднимаем контраст и уводим в глубокую зелень
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.06)

    rgba = im.convert("RGBA"); rgba.putalpha(mask)
    for size in (512, 256, 192, 128, 96):
        save_png(rgba.resize((size, size), Image.LANCZOS), f"logo-{size}.png")
    save_webp(rgba.resize((512, 512), Image.LANCZOS), "logo-512.webp", q=90, lossless=False)

    # фавиконки — на непрозрачной тёмно-зелёной подложке
    for size, name in ((180, "apple-touch-icon.png"), (32, "favicon-32.png"), (16, "favicon-16.png")):
        bg = Image.new("RGB", (size, size), DEEP)
        ic = rgba.resize((size, size), Image.LANCZOS)
        bg.paste(ic, (0, 0), ic)
        save_png(bg, name)
    ico = Image.new("RGB", (64, 64), DEEP)
    icl = rgba.resize((64, 64), Image.LANCZOS); ico.paste(icl, (0, 0), icl)
    ico.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"  favicon.ico                        {(OUT/'favicon.ico').stat().st_size/1024:7.1f} KB")


# ─────────────────────────────────────────────── ГЕРОЙ / БАННЕРЫ
def tint(im, shadow=DEEP, light=(0xE8, 0xE2, 0xCE), amount=0.75):
    """Мягкий дуотон: тени уводим в тёмно-зелёный, света — в пергамент."""
    g = np.asarray(im.convert("L"), dtype=np.float32) / 255.0
    g = g[..., None]
    sh = np.array(shadow, dtype=np.float32)
    li = np.array(light, dtype=np.float32)
    duo = sh * (1 - g) + li * g
    base = np.asarray(im.convert("RGB"), dtype=np.float32)
    out = base * (1 - amount) + duo * amount
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def darken_gradient(im, top=0.30, bottom=0.86):
    """Вертикальная тёмно-зелёная вуаль — чтобы текст поверх всегда читался."""
    w, h = im.size
    a = np.linspace(top, bottom, h, dtype=np.float32)[:, None, None]
    base = np.asarray(im, dtype=np.float32)
    veil = np.array(DEEP, dtype=np.float32)[None, None, :]
    return Image.fromarray(np.clip(base * (1 - a) + veil * a, 0, 255).astype(np.uint8))


def build_hero():
    print("Герой (рыцарь):")
    im = Image.open(KNIGHT).convert("RGB")
    im = tint(im, amount=0.55)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    im = darken_gradient(im, 0.34, 0.88)
    for w in (1920, 1280, 800):
        h = round(im.height * w / im.width)
        save_webp(im.resize((w, h), Image.LANCZOS), f"hero-{w}.webp", q=78)
    h = round(im.height * 1280 / im.width)
    im.resize((1280, h), Image.LANCZOS).save(OUT / "hero-1280.jpg", "JPEG", quality=76, optimize=True, progressive=True)
    print(f"  hero-1280.jpg                      {(OUT/'hero-1280.jpg').stat().st_size/1024:7.1f} KB")


def build_banner():
    print("Баннер (лес):")
    im = Image.open(FOREST).convert("RGB")
    im = tint(im, amount=0.62)
    im = darken_gradient(im, 0.46, 0.80)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    for w in (1600, 1000, 640):
        h = round(im.height * w / im.width)
        save_webp(im.resize((w, h), Image.LANCZOS), f"banner-{w}.webp", q=74)

    # узкая полоса для шапок разделов
    strip = im.crop((0, int(im.height * 0.28), im.width, int(im.height * 0.72)))
    for w in (1600, 800):
        h = round(strip.height * w / strip.width)
        save_webp(strip.resize((w, h), Image.LANCZOS), f"strip-{w}.webp", q=72)


# ─────────────────────────────────────────────── ТЕКСТУРЫ
def _seamless_noise(size, octaves, rng):
    """Бесшовный фрактальный шум через тайлящиеся синусоиды в частотной области."""
    acc = np.zeros((size, size), dtype=np.float32)
    amp = 1.0
    for o in octaves:
        f = np.zeros((size, size), dtype=np.complex64)
        yy, xx = np.mgrid[0:size, 0:size]
        cy = np.minimum(yy, size - yy); cx = np.minimum(xx, size - xx)
        r = np.sqrt(cx ** 2 + cy ** 2)
        band = np.exp(-((r - o) ** 2) / (2 * (o * 0.55) ** 2))
        phase = rng.uniform(0, 2 * np.pi, (size, size)).astype(np.float32)
        f = band * np.exp(1j * phase)
        layer = np.real(np.fft.ifft2(f))
        layer /= (np.abs(layer).max() + 1e-6)
        acc += layer * amp
        amp *= 0.62
    acc -= acc.min(); acc /= (acc.max() + 1e-6)
    return acc


def build_paper():
    print("Текстуры бумаги:")
    rng = np.random.default_rng(7)
    S = 512
    base = _seamless_noise(S, [3, 7, 17, 41], rng)          # крупные разводы
    fib = _seamless_noise(S, [90, 150], rng)                 # волокна
    grain = rng.normal(0.5, 0.14, (S, S)).astype(np.float32)
    grain = np.clip(grain, 0, 1)

    v = 0.55 * base + 0.28 * fib + 0.17 * grain
    v = (v - v.min()) / (v.max() - v.min())

    # светлый пергамент: очень слабый контраст, тёплый оттенок
    lo = np.array([0xE9, 0xE0, 0xC7], dtype=np.float32)
    hi = np.array([0xF7, 0xF1, 0xE1], dtype=np.float32)
    img = lo + (hi - lo) * v[..., None]
    save_png(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGB"), "paper.png")

    # тёмная фактура для зелёных плашек
    lo2 = np.array([0x10, 0x2A, 0x22], dtype=np.float32)
    hi2 = np.array([0x1B, 0x3E, 0x31], dtype=np.float32)
    img2 = lo2 + (hi2 - lo2) * v[..., None]
    save_png(Image.fromarray(np.clip(img2, 0, 255).astype(np.uint8)).convert("RGB"), "paper-dark.png")


# ─────────────────────────────────────────────── OG-КАРТИНКА
def build_og():
    print("Картинка для репостов:")
    W, H = 1200, 630
    bg = Image.open(OUT / "hero-1920.webp").convert("RGB")
    scale = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * scale), round(bg.height * scale)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 3,
                  (bg.width - W) // 2 + W, (bg.height - H) // 3 + H))
    veil = Image.new("RGB", (W, H), DEEP)
    bg = Image.blend(bg, veil, 0.42)
    logo = Image.open(OUT / "logo-512.png").convert("RGBA").resize((260, 260), Image.LANCZOS)
    bg.paste(logo, ((W - 260) // 2, 96), logo)
    d = ImageDraw.Draw(bg)
    d.line([(W // 2 - 220, 404), (W // 2 + 220, 404)], fill=GOLD, width=2)
    bg.save(OUT / "og-image.jpg", "JPEG", quality=84, optimize=True)
    print(f"  og-image.jpg                       {(OUT/'og-image.jpg').stat().st_size/1024:7.1f} KB")


if __name__ == "__main__":
    build_logo(); build_hero(); build_banner(); build_paper(); build_og()
    print("\nГотово.")
