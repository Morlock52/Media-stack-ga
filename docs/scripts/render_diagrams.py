from __future__ import annotations

from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "images"

WIDTH = 2916
HEIGHT = 1655

COLORS = {
    "bg_top": (4, 10, 12),
    "bg_bottom": (3, 7, 9),
    "grid": (24, 84, 74),
    "primary": (16, 185, 129),
    "accent": (34, 211, 238),
    "highlight": (110, 231, 183),
    "text": (220, 255, 240),
    "muted": (150, 210, 190),
    "card": (10, 18, 20),
}


def load_font(size: int, mono: bool = False) -> ImageFont.FreeTypeFont:
    candidates = []
    if mono:
        candidates = [
            "/System/Library/Fonts/Supplemental/Andale Mono.ttf",
            "/System/Library/Fonts/Supplemental/Courier New.ttf",
            "/Library/Fonts/Andale Mono.ttf",
            "/Library/Fonts/Courier New.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica Neue.ttf",
            "/Library/Fonts/Arial.ttf",
            "/Library/Fonts/Helvetica.ttf",
        ]

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_vertical_gradient(base: Image.Image) -> None:
    gradient = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(gradient)
    top = COLORS["bg_top"]
    bottom = COLORS["bg_bottom"]
    for y in range(HEIGHT):
        t = y / HEIGHT
        color = (
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
            255,
        )
        gdraw.line([(0, y), (WIDTH, y)], fill=color)
    base.alpha_composite(gradient)


def draw_glow_fields(base: Image.Image) -> None:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((120, 80, 820, 760), fill=(*COLORS["primary"], 70))
    gdraw.ellipse((1900, 40, 2750, 760), fill=(*COLORS["accent"], 60))
    gdraw.ellipse((1100, 860, 2000, 1560), fill=(*COLORS["highlight"], 55))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    base.alpha_composite(glow)


def draw_grid(base: Image.Image) -> None:
    grid = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grid)
    for x in range(0, WIDTH, 84):
        gdraw.line([(x, 0), (x, HEIGHT)], fill=(*COLORS["grid"], 36))
    for y in range(0, HEIGHT, 84):
        gdraw.line([(0, y), (WIDTH, y)], fill=(*COLORS["grid"], 30))
    base.alpha_composite(grid)


def draw_scanlines(base: Image.Image) -> None:
    scan = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(scan)
    for y in range(0, HEIGHT, 5):
        alpha = 18 if y % 10 == 0 else 10
        sdraw.line([(0, y), (WIDTH, y)], fill=(255, 255, 255, alpha))
    base.alpha_composite(scan)


def draw_matrix_rain(base: Image.Image, seed: int = 20251220) -> None:
    import random

    rng = random.Random(seed)
    rain = Image.new("RGBA", base.size, (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(rain)
    for x in range(40, WIDTH, 44):
        if rng.random() < 0.65:
            start = rng.randint(-200, HEIGHT)
            length = rng.randint(180, 720)
            head = start + length
            for y in range(start, start + length, 22):
                alpha = int(28 + 70 * rng.random())
                rdraw.rectangle([x, y, x + 2, y + 12], fill=(18, 200, 140, alpha))
            rdraw.rectangle([x, head - 8, x + 3, head + 14], fill=(180, 255, 220, 160))
    rain = rain.filter(ImageFilter.GaussianBlur(0.6))
    base.alpha_composite(rain)


def draw_vignette(base: Image.Image) -> None:
    mask = Image.new("L", base.size, 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse((-WIDTH * 0.15, -HEIGHT * 0.2, WIDTH * 1.15, HEIGHT * 1.25), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(180))
    vignette = Image.new("RGBA", base.size, (0, 0, 0, 140))
    base.paste(vignette, (0, 0), mask=ImageOps.invert(mask))


def draw_hud_frame(base: Image.Image) -> None:
    hud = Image.new("RGBA", base.size, (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(hud)
    color = (*COLORS["accent"], 120)
    for (x, y) in [(36, 40), (WIDTH - 36, 40), (36, HEIGHT - 40), (WIDTH - 36, HEIGHT - 40)]:
        x0 = x - (0 if x < WIDTH / 2 else 120)
        x1 = x + (120 if x < WIDTH / 2 else 0)
        y0 = y - (0 if y < HEIGHT / 2 else 80)
        y1 = y + (80 if y < HEIGHT / 2 else 0)
        hdraw.line([(x0, y), (x1, y)], fill=color, width=3)
        hdraw.line([(x, y0), (x, y1)], fill=color, width=3)
    hud = hud.filter(ImageFilter.GaussianBlur(0.6))
    base.alpha_composite(hud)


def draw_background(draw: ImageDraw.ImageDraw, base: Image.Image) -> None:
    draw_vertical_gradient(base)
    draw_glow_fields(base)
    draw_grid(base)
    draw_matrix_rain(base)
    draw_scanlines(base)
    draw_vignette(base)
    draw_hud_frame(base)


def draw_text_glow(base: Image.Image, position: Tuple[int, int], text: str, font: ImageFont.FreeTypeFont) -> None:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.text(position, text, font=font, fill=(*COLORS["accent"], 140))
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    base.alpha_composite(glow)
    draw = ImageDraw.Draw(base)
    draw.text(position, text, font=font, fill=(*COLORS["text"], 255))


def draw_title(draw: ImageDraw.ImageDraw, text: str, base: Image.Image) -> None:
    font = load_font(54)
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (WIDTH - (bbox[2] - bbox[0])) // 2
    draw_text_glow(base, (x, 56), text, font)


def draw_card(
    base: Image.Image,
    rect: Tuple[int, int, int, int],
    title: str,
    lines: Iterable[str],
    accent: Tuple[int, int, int],
) -> None:
    draw = ImageDraw.Draw(base)
    x0, y0, x1, y1 = rect
    radius = 26

    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.rounded_rectangle(rect, radius=radius, fill=(*accent, 75))
    glow = glow.filter(ImageFilter.GaussianBlur(36))
    base.alpha_composite(glow)

    draw.rounded_rectangle(rect, radius=radius, fill=(*COLORS["card"], 235), outline=(*accent, 190), width=3)
    draw.rounded_rectangle((x0 + 8, y0 + 8, x1 - 8, y1 - 8), radius=radius - 6, outline=(*accent, 70), width=1)
    draw.line([(x0 + 20, y0 + 52), (x1 - 20, y0 + 52)], fill=(*accent, 180), width=2)
    draw.rectangle((x0 + 20, y0 + 16, x0 + 90, y0 + 24), fill=(*accent, 200))
    draw.rectangle((x0 + 96, y0 + 16, x0 + 148, y0 + 24), fill=(*COLORS["primary"], 200))

    title_font = load_font(36)
    body_font = load_font(26)
    mono_font = load_font(24, mono=True)

    draw_text_glow(base, (x0 + 26, y0 + 12), title, title_font)

    y = y0 + 70
    for idx, line in enumerate(lines):
        font = mono_font if idx == 0 and line.startswith(">") else body_font
        color = (*COLORS["muted"], 255)
        if line.startswith(">"):
            color = (120, 230, 200, 255)
        draw.text((x0 + 26, y), line, font=font, fill=color)
        y += 32


def draw_arrow(base: Image.Image, start: Tuple[int, int], end: Tuple[int, int], color: Tuple[int, int, int]) -> None:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.line([start, end], fill=(*color, 80), width=10)
    glow = glow.filter(ImageFilter.GaussianBlur(6))
    base.alpha_composite(glow)

    draw = ImageDraw.Draw(base)
    draw.line([start, end], fill=(*color, 220), width=4)
    # Arrow head
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = max((dx**2 + dy**2) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    perp = (-uy, ux)
    size = 14
    p1 = (end[0] - ux * size * 2, end[1] - uy * size * 2)
    p2 = (p1[0] + perp[0] * size, p1[1] + perp[1] * size)
    p3 = (p1[0] - perp[0] * size, p1[1] - perp[1] * size)
    draw.polygon([end, p2, p3], fill=(*color, 220))


def render_architecture() -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), (5, 8, 10, 255))
    draw_background(ImageDraw.Draw(base), base)
    draw_title(ImageDraw.Draw(base), "Architecture Overview — Media Stack GA (Dec 20, 2025)", base)

    cards = [
        ((160, 230, 500, 400), "Clients", ["> browsers, TV, mobile", "Plex / Jellyfin apps"], COLORS["accent"]),
        ((540, 210, 1010, 410), "Cloudflare Tunnel", ["> outbound-only edge", "Zero-trust ingress"], COLORS["primary"]),
        ((1040, 210, 1400, 410), "Traefik Edge", ["> host routing", "HTTP entrypoint"], COLORS["accent"]),
        ((1430, 210, 1790, 410), "Authelia SSO", ["> SSO + MFA", "Policy enforcement"], COLORS["highlight"]),
        ((1830, 150, 2700, 470), "App Mesh", ["> Homepage + Overseerr", "Plex / Jellyfin / *Arr", "Portainer + Dozzle"], COLORS["primary"]),
        ((540, 560, 990, 760), "Wizard + Control", ["> local UI + API", "Remote deploy + logs"], COLORS["accent"]),
        ((1040, 560, 1620, 760), "Downloads", ["> Gluetun VPN", "qBittorrent + FlareSolverr"], COLORS["primary"]),
        ((1830, 530, 2700, 780), "Storage", ["> DATA_ROOT", "Configs + Media"], COLORS["highlight"]),
    ]

    for rect, title, lines, accent in cards:
        draw_card(base, rect, title, lines, accent)

    arrow_color = (80, 220, 190)
    draw_arrow(base, (500, 315), (540, 315), arrow_color)
    draw_arrow(base, (1010, 315), (1040, 315), arrow_color)
    draw_arrow(base, (1400, 315), (1430, 315), arrow_color)
    draw_arrow(base, (1790, 315), (1830, 315), arrow_color)
    draw_arrow(base, (1330, 410), (1330, 560), arrow_color)
    draw_arrow(base, (1530, 760), (1830, 650), arrow_color)
    draw_arrow(base, (990, 650), (1040, 650), arrow_color)
    draw_arrow(base, (900, 660), (1830, 660), arrow_color)
    draw_arrow(base, (1010, 660), (540, 660), arrow_color)

    return base.convert("RGB")


def render_security() -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), (5, 8, 10, 255))
    draw_background(ImageDraw.Draw(base), base)
    draw_title(ImageDraw.Draw(base), "Security Controls Map — Defense in Depth", base)

    center_rect = (1160, 620, 1750, 980)
    draw_card(
        base,
        center_rect,
        "Media Stack Core",
        ["> services + data", "Protected by layered controls"],
        COLORS["accent"],
    )

    controls = [
        ((200, 260, 750, 460), "Zero-Trust Edge", ["Cloudflare Tunnel", "No inbound ports"], COLORS["primary"]),
        ((880, 260, 1430, 460), "SSO + MFA", ["Authelia policies", "WebAuthn/TOTP"], COLORS["highlight"]),
        ((1560, 260, 2260, 460), "Least Privilege", ["no-new-privileges", "socket proxy (wizard)"], COLORS["accent"]),
        ((200, 1040, 800, 1240), "VPN Kill Switch", ["Gluetun firewall", "No-leak downloads"], COLORS["highlight"]),
        ((940, 1040, 1600, 1240), "Secrets & Tokens", [".env + Authelia keys", "Rotate regularly"], COLORS["primary"]),
        ((1750, 1040, 2460, 1240), "Audit & Logs", ["Remote deploy logs", "Container telemetry"], COLORS["accent"]),
    ]

    for rect, title, lines, accent in controls:
        draw_card(base, rect, title, lines, accent)

    for rect, *_ in controls:
        sx = (rect[0] + rect[2]) // 2
        sy = rect[1] if rect[1] > center_rect[1] else rect[3]
        ex = (center_rect[0] + center_rect[2]) // 2
        ey = center_rect[1] if rect[1] > center_rect[1] else center_rect[3]
        draw_arrow(base, (sx, sy), (ex, ey), (80, 220, 190))

    return base.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    architecture = render_architecture()
    security = render_security()

    architecture.save(OUT_DIR / "architecture_overview.png")
    architecture.save(OUT_DIR / "architecture_overview.jpg", quality=92)

    security.save(OUT_DIR / "security_controls.png")
    security.save(OUT_DIR / "security_controls.jpg", quality=92)


if __name__ == "__main__":
    main()
