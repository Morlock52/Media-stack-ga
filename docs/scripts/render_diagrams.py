from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "images"

WIDTH = 2916
HEIGHT = 1655
ICON_SIZE = 52

ARROW_TRAFFIC = (140, 245, 220)
ARROW_CONTROL = (96, 210, 178)
ARROW_DATA = (110, 230, 150)

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
    "zone_edge": (14, 78, 70),
    "zone_ops": (12, 62, 70),
    "zone_data": (12, 70, 92),
    "tag_bg": (6, 12, 14),
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
        alpha = 8 if y % 10 == 0 else 4
        sdraw.line([(0, y), (WIDTH, y)], fill=(255, 255, 255, alpha))
    base.alpha_composite(scan)


def draw_matrix_rain(base: Image.Image, seed: int = 20251220) -> None:
    import random

    rng = random.Random(seed)
    rain = Image.new("RGBA", base.size, (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(rain)
    for x in range(40, WIDTH, 44):
        if rng.random() < 0.35:
            start = rng.randint(-200, HEIGHT)
            length = rng.randint(180, 720)
            head = start + length
            for y in range(start, start + length, 22):
                alpha = int(14 + 40 * rng.random())
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
    draw.text((position[0] + 2, position[1] + 2), text, font=font, fill=(0, 0, 0, 160))
    draw.text(position, text, font=font, fill=(*COLORS["text"], 255))


def draw_title(draw: ImageDraw.ImageDraw, text: str, base: Image.Image) -> None:
    font = load_font(60)
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (WIDTH - (bbox[2] - bbox[0])) // 2
    draw_text_glow(base, (x, 56), text, font)


def draw_tag(
    base: Image.Image,
    center: Tuple[float, float],
    text: str,
    accent: Tuple[int, int, int],
    font_size: int = 22,
) -> None:
    draw = ImageDraw.Draw(base)
    font = load_font(font_size, mono=True)
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    pad_x = 16
    pad_y = 8
    x0 = center[0] - width / 2 - pad_x
    y0 = center[1] - height / 2 - pad_y
    x1 = center[0] + width / 2 + pad_x
    y1 = center[1] + height / 2 + pad_y
    draw.rounded_rectangle((x0, y0, x1, y1), radius=14, fill=(*COLORS["tag_bg"], 220), outline=(*accent, 190), width=2)
    draw.text((center[0] - width / 2, center[1] - height / 2 - 1), text, font=font, fill=(*COLORS["text"], 255))


def draw_zone(base: Image.Image, rect: Tuple[int, int, int, int], title: str, color: Tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(rect, radius=36, fill=(*color, 28), outline=(*color, 110), width=2)
    draw_tag(base, (rect[0] + 180, rect[1] + 32), title, color, font_size=22)


def draw_legend(
    base: Image.Image,
    rect: Tuple[int, int, int, int],
    title: str,
    items: Iterable[Tuple[str, Tuple[int, int, int]]],
) -> None:
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(rect, radius=26, fill=(*COLORS["card"], 230), outline=(*COLORS["accent"], 120), width=2)
    draw_text_glow(base, (rect[0] + 22, rect[1] + 12), title, load_font(30))

    font = load_font(24)
    y = rect[1] + 70
    for label, color in items:
        start = (rect[0] + 38, y + 12)
        end = (rect[0] + 150, y + 12)
        draw_arrow(base, start, end, color, curve=0.0)
        draw.text((rect[0] + 180, y - 2), label, font=font, fill=(*COLORS["muted"], 255))
        y += 54


def draw_rings(base: Image.Image, center: Tuple[int, int], radii: Iterable[int], color: Tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(base)
    for radius in radii:
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius,
                center[0] + radius,
                center[1] + radius,
            ),
            outline=(*color, 70),
            width=3,
        )


def draw_icon(base: Image.Image, center: Tuple[int, int], kind: str, accent: Tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(base)
    cx, cy = center
    r = ICON_SIZE // 2
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*accent, 190), outline=(255, 255, 255, 90), width=2)
    draw.ellipse((cx - r + 6, cy - r + 6, cx + r - 6, cy + r - 6), fill=(8, 16, 18, 220), outline=(*accent, 140), width=2)

    def line(p1: Tuple[float, float], p2: Tuple[float, float], width: int = 2) -> None:
        draw.line([(int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1]))], fill=(*accent, 220), width=width)

    def circle(center_x: float, center_y: float, radius: float) -> None:
        draw.ellipse(
            (
                int(center_x - radius),
                int(center_y - radius),
                int(center_x + radius),
                int(center_y + radius),
            ),
            fill=(*accent, 220),
        )

    x0, y0, x1, y1 = cx - r + 10, cy - r + 10, cx + r - 10, cy + r - 10
    if kind in {"clients", "nodes"}:
        circle(cx - 8, cy + 6, 4)
        circle(cx + 8, cy + 6, 4)
        circle(cx, cy - 8, 4)
        line((cx - 5, cy + 2), (cx, cy - 4))
        line((cx + 5, cy + 2), (cx, cy - 4))
    elif kind == "cloud":
        circle(cx - 10, cy, 6)
        circle(cx, cy - 6, 7)
        circle(cx + 10, cy, 6)
        draw.rectangle((cx - 16, cy, cx + 16, cy + 8), fill=(*accent, 220))
    elif kind == "edge":
        draw.polygon([(cx, y0), (x1, cy), (cx, y1), (x0, cy)], fill=(*accent, 220))
        draw.polygon([(cx, y0 + 6), (x1 - 6, cy), (cx, y1 - 6), (x0 + 6, cy)], fill=(8, 16, 18, 220))
    elif kind == "shield":
        draw.polygon(
            [(cx, y0), (x1, y0 + 6), (x1 - 6, cy + 8), (cx, y1), (x0 + 6, cy + 8), (x0, y0 + 6)],
            fill=(*accent, 220),
        )
        draw.polygon(
            [(cx, y0 + 6), (x1 - 8, y0 + 10), (x1 - 10, cy + 6), (cx, y1 - 6), (x0 + 10, cy + 6), (x0 + 8, y0 + 10)],
            fill=(8, 16, 18, 220),
        )
    elif kind == "grid":
        size = 8
        gap = 6
        start_x = cx - size - gap // 2
        start_y = cy - size - gap // 2
        for row in range(2):
            for col in range(2):
                x = start_x + col * (size + gap)
                y = start_y + row * (size + gap)
                draw.rectangle((x, y, x + size, y + size), fill=(*accent, 220))
    elif kind == "spark":
        line((cx - 10, cy), (cx + 10, cy), 3)
        line((cx, cy - 10), (cx, cy + 10), 3)
        line((cx - 7, cy - 7), (cx + 7, cy + 7), 2)
        line((cx - 7, cy + 7), (cx + 7, cy - 7), 2)
    elif kind == "download":
        line((cx, cy - 10), (cx, cy + 8), 3)
        draw.polygon([(cx - 8, cy + 4), (cx + 8, cy + 4), (cx, cy + 14)], fill=(*accent, 220))
        line((cx - 12, cy - 14), (cx + 12, cy - 14), 2)
    elif kind == "storage":
        draw.ellipse((x0, y0, x1, y0 + 10), fill=(*accent, 220))
        draw.rectangle((x0, y0 + 5, x1, y1 - 6), fill=(*accent, 200))
        draw.ellipse((x0, y1 - 12, x1, y1), fill=(*accent, 220))
        draw.ellipse((x0 + 3, y0 + 3, x1 - 3, y0 + 8), fill=(8, 16, 18, 220))
    elif kind == "lock":
        draw.rectangle((cx - 10, cy - 2, cx + 10, cy + 12), fill=(*accent, 220))
        draw.arc((cx - 8, cy - 14, cx + 8, cy + 2), start=0, end=180, fill=(*accent, 220), width=3)
        draw.ellipse((cx - 3, cy + 2, cx + 3, cy + 8), fill=(8, 16, 18, 220))
    elif kind == "key":
        draw.ellipse((cx - 12, cy - 6, cx, cy + 6), outline=(*accent, 220), width=3)
        line((cx, cy), (cx + 12, cy), 3)
        line((cx + 6, cy), (cx + 6, cy + 6), 2)
    elif kind == "list":
        for offset in (-8, 0, 8):
            line((cx - 10, cy + offset), (cx + 10, cy + offset), 3)


def draw_card(
    base: Image.Image,
    rect: Tuple[int, int, int, int],
    title: str,
    lines: Iterable[str],
    accent: Tuple[int, int, int],
    icon: str,
) -> None:
    draw = ImageDraw.Draw(base)
    x0, y0, x1, y1 = rect
    radius = 26

    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.rounded_rectangle(rect, radius=radius, fill=(*accent, 75))
    glow = glow.filter(ImageFilter.GaussianBlur(36))
    base.alpha_composite(glow)

    draw.rounded_rectangle(rect, radius=radius, fill=(*COLORS["card"], 235), outline=(*accent, 200), width=3)
    draw.rounded_rectangle((x0 + 8, y0 + 8, x1 - 8, y1 - 8), radius=radius - 6, outline=(*accent, 70), width=1)
    draw.line([(x0 + 20, y0 + 52), (x1 - 20, y0 + 52)], fill=(*accent, 180), width=2)
    draw.rectangle((x0 + 20, y0 + 16, x0 + 90, y0 + 24), fill=(*accent, 200))
    draw.rectangle((x0 + 96, y0 + 16, x0 + 148, y0 + 24), fill=(*COLORS["primary"], 200))

    title_font = load_font(38)
    body_font = load_font(28)
    mono_font = load_font(26, mono=True)

    icon_center = (x0 + 48, y0 + 44)
    draw_icon(base, icon_center, icon, accent)
    draw_text_glow(base, (x0 + 92, y0 + 10), title, title_font)

    y = y0 + 76
    for idx, line in enumerate(lines):
        font = mono_font if idx == 0 and line.startswith(">") else body_font
        color = (*COLORS["muted"], 255)
        if line.startswith(">"):
            color = (120, 230, 200, 255)
        draw.text((x0 + 26, y), line, font=font, fill=color)
        y += 32


def bezier_points(
    start: Tuple[int, int],
    control: Tuple[float, float],
    end: Tuple[int, int],
    steps: int = 32,
) -> list[Tuple[float, float]]:
    points: list[Tuple[float, float]] = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0]
        y = mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1]
        points.append((x, y))
    return points


def draw_arrow(
    base: Image.Image,
    start: Tuple[int, int],
    end: Tuple[int, int],
    color: Tuple[int, int, int],
    curve: float = 0.0,
    label: Optional[str] = None,
    label_offset: Tuple[int, int] = (0, 0),
    label_color: Optional[Tuple[int, int, int]] = None,
) -> None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = max((dx**2 + dy**2) ** 0.5, 1)
    nx, ny = -dy / length, dx / length
    mx, my = (start[0] + end[0]) / 2, (start[1] + end[1]) / 2
    control = (mx + nx * length * curve, my + ny * length * curve)
    points = bezier_points(start, control, end, steps=38)

    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.line(points, fill=(*color, 70), width=10, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(6))
    base.alpha_composite(glow)

    draw = ImageDraw.Draw(base)
    draw.line(points, fill=(*color, 210), width=4, joint="curve")

    # Arrow head (chevron)
    tail = points[-3]
    tip = points[-1]
    vx = tip[0] - tail[0]
    vy = tip[1] - tail[1]
    vlen = max((vx**2 + vy**2) ** 0.5, 1)
    ux, uy = vx / vlen, vy / vlen
    angle = 0.5
    size = 18
    lx = tip[0] - size * (ux * 0.9 + uy * angle)
    ly = tip[1] - size * (uy * 0.9 - ux * angle)
    rx = tip[0] - size * (ux * 0.9 - uy * angle)
    ry = tip[1] - size * (uy * 0.9 + ux * angle)
    draw.line([tip, (lx, ly)], fill=(*color, 235), width=4)
    draw.line([tip, (rx, ry)], fill=(*color, 235), width=4)

    if label:
        mid = points[len(points) // 2]
        label_x = mid[0] + nx * 22 + label_offset[0]
        label_y = mid[1] + ny * 22 + label_offset[1]
        draw_tag(base, (label_x, label_y), label, label_color or color, font_size=20)


def render_architecture() -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), (5, 8, 10, 255))
    draw_background(ImageDraw.Draw(base), base)
    draw_title(ImageDraw.Draw(base), "Architecture Overview — Media Stack GA (Dec 20, 2025)", base)

    draw_zone(base, (90, 170, 2810, 520), "EDGE & IDENTITY", COLORS["zone_edge"])
    draw_zone(base, (420, 560, 1760, 940), "OPERATIONS", COLORS["zone_ops"])
    draw_zone(base, (1790, 560, 2810, 940), "DATA LAYER", COLORS["zone_data"])

    cards = [
        ((150, 230, 590, 440), "Clients", ["> browsers, TV, mobile", "Plex / Jellyfin apps"], COLORS["accent"], "clients"),
        ((630, 210, 1110, 440), "Cloudflare Tunnel", ["> outbound-only edge", "Zero-trust ingress"], COLORS["primary"], "cloud"),
        ((1150, 210, 1580, 440), "Traefik Edge", ["> host routing", "HTTP entrypoint"], COLORS["accent"], "edge"),
        ((1620, 210, 2020, 440), "Authelia SSO", ["> SSO + MFA", "Policy enforcement"], COLORS["highlight"], "shield"),
        ((2050, 170, 2790, 480), "App Mesh", ["> Homepage + Overseerr", "Plex / Jellyfin / *Arr", "Portainer + Dozzle"], COLORS["primary"], "grid"),
        ((520, 620, 1020, 860), "Wizard + Control", ["> local UI + API", "Remote deploy + logs"], COLORS["accent"], "spark"),
        ((1080, 620, 1730, 860), "Downloads", ["> Gluetun VPN", "qBittorrent + FlareSolverr"], COLORS["primary"], "download"),
        ((1810, 600, 2790, 880), "Storage", ["> DATA_ROOT", "Configs + Media"], COLORS["highlight"], "storage"),
    ]

    for rect, title, lines, accent, icon in cards:
        draw_card(base, rect, title, lines, accent, icon)

    draw_arrow(base, (590, 335), (630, 335), ARROW_TRAFFIC, curve=-0.18, label="HTTPS")
    draw_arrow(base, (1110, 335), (1150, 335), ARROW_TRAFFIC, curve=-0.16, label="Zero-trust")
    draw_arrow(base, (1580, 335), (1620, 335), ARROW_TRAFFIC, curve=-0.16, label="SSO", label_offset=(0, -18))
    draw_arrow(base, (2020, 335), (2050, 335), ARROW_TRAFFIC, curve=-0.2, label="Apps")
    draw_arrow(base, (1365, 440), (1365, 620), ARROW_CONTROL, curve=0.12, label="Admin UI", label_offset=(60, 0))
    draw_arrow(base, (1020, 740), (1080, 740), ARROW_CONTROL, curve=0.16, label="Orchestration", label_offset=(0, 18))
    draw_arrow(base, (1730, 740), (1810, 740), ARROW_DATA, curve=0.16, label="Downloads", label_offset=(0, 18))
    draw_arrow(base, (2420, 480), (2420, 600), ARROW_DATA, curve=-0.12, label="Configs + Media", label_offset=(120, 0))

    draw_legend(
        base,
        (120, 980, 920, 1520),
        "Legend",
        [
            ("User traffic", ARROW_TRAFFIC),
            ("Control plane", ARROW_CONTROL),
            ("Data flow", ARROW_DATA),
        ],
    )

    return base.convert("RGB")


def render_security() -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), (5, 8, 10, 255))
    draw_background(ImageDraw.Draw(base), base)
    draw_title(ImageDraw.Draw(base), "Security Controls Map — Defense in Depth", base)

    draw_zone(base, (140, 190, 2776, 520), "PERIMETER CONTROLS", COLORS["zone_edge"])
    draw_zone(base, (140, 560, 2776, 960), "ACCESS & POLICY", COLORS["zone_ops"])
    draw_zone(base, (140, 1000, 2776, 1370), "OPERATIONS & AUDIT", COLORS["zone_data"])

    center_rect = (980, 600, 1930, 920)

    controls = [
        ((720, 240, 1380, 480), "Zero-Trust Edge", ["Cloudflare Tunnel", "No inbound ports"], COLORS["primary"], "shield"),
        ((1530, 240, 2190, 480), "VPN Kill Switch", ["Gluetun firewall", "No-leak downloads"], COLORS["highlight"], "shield"),
        ((200, 620, 860, 900), "SSO + MFA", ["Authelia policies", "WebAuthn/TOTP"], COLORS["highlight"], "lock"),
        ((2050, 620, 2710, 900), "Least Privilege", ["no-new-privileges", "socket proxy (wizard)"], COLORS["accent"], "key"),
        ((720, 1060, 1380, 1300), "Secrets & Tokens", [".env + Authelia keys", "Rotate regularly"], COLORS["primary"], "lock"),
        ((1530, 1060, 2190, 1300), "Audit & Logs", ["Remote deploy logs", "Container telemetry"], COLORS["accent"], "list"),
    ]

    for rect, title, lines, accent, icon in controls:
        draw_card(base, rect, title, lines, accent, icon)

    draw_card(
        base,
        center_rect,
        "Media Stack Core",
        ["> services + data", "Protected by layered controls"],
        COLORS["accent"],
        "grid",
    )
    draw_tag(base, (2460, 1500), "Layered defense model", COLORS["accent"], font_size=22)

    return base.convert("RGB")


def render_access_modes() -> Image.Image:
    base = Image.new("RGBA", (WIDTH, HEIGHT), (5, 8, 10, 255))
    draw_background(ImageDraw.Draw(base), base)
    draw_title(ImageDraw.Draw(base), "Access Modes — LAN vs Cloudflare (Dec 2025)", base)

    lan_zone = (120, 260, 1420, 1240)
    remote_zone = (1490, 260, 2790, 1240)

    draw_zone(base, lan_zone, "LAN-ONLY", COLORS["zone_ops"])
    draw_zone(base, remote_zone, "REMOTE (ZERO-TRUST)", COLORS["zone_edge"])

    draw_tag(base, (lan_zone[0] + 300, lan_zone[1] + 70), "no SSO / no tunnel", COLORS["primary"], font_size=20)
    draw_tag(base, (remote_zone[0] + 360, remote_zone[1] + 70), "tunnel + SSO", COLORS["accent"], font_size=20)

    lan_cards = [
        ((200, 520, 540, 760), "Clients", ["> browser, TV", "mobile devices"], COLORS["accent"], "clients"),
        ((620, 520, 960, 760), "LAN Router", ["> DNS / hosts", "local gateway"], COLORS["primary"], "edge"),
        ((1040, 520, 1380, 760), "Apps", ["> Traefik + stack", "local access"], COLORS["highlight"], "grid"),
    ]

    for rect, title, lines, accent, icon in lan_cards:
        draw_card(base, rect, title, lines, accent, icon)

    remote_cards = [
        ((1570, 520, 1910, 760), "Clients", ["> browser, TV", "mobile devices"], COLORS["accent"], "clients"),
        ((1990, 520, 2330, 760), "Cloudflare", ["> tunnel edge", "Authelia SSO"], COLORS["primary"], "cloud"),
        ((2410, 520, 2750, 760), "Apps", ["> Traefik + stack", "zero-trust"], COLORS["highlight"], "grid"),
    ]

    for rect, title, lines, accent, icon in remote_cards:
        draw_card(base, rect, title, lines, accent, icon)

    draw_arrow(base, (540, 640), (620, 640), ARROW_TRAFFIC, curve=-0.12, label="LAN")
    draw_arrow(base, (960, 640), (1040, 640), ARROW_TRAFFIC, curve=-0.12, label="HTTP")

    draw_arrow(base, (1910, 640), (1990, 640), ARROW_TRAFFIC, curve=-0.12, label="HTTPS")
    draw_arrow(base, (2330, 640), (2410, 640), ARROW_TRAFFIC, curve=-0.12, label="SSO")

    draw_tag(base, (lan_zone[0] + 430, lan_zone[3] - 90), "http://<server-ip>", COLORS["accent"], font_size=22)
    draw_tag(base, (remote_zone[0] + 470, remote_zone[3] - 90), "https://<service>.<domain>", COLORS["primary"], font_size=22)

    return base.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    architecture = render_architecture()
    security = render_security()
    access_modes = render_access_modes()

    architecture.save(OUT_DIR / "architecture_overview.png")
    architecture.save(OUT_DIR / "architecture_overview.jpg", quality=92)

    security.save(OUT_DIR / "security_controls.png")
    security.save(OUT_DIR / "security_controls.jpg", quality=92)

    access_modes.save(OUT_DIR / "access_modes.png")
    access_modes.save(OUT_DIR / "access_modes.jpg", quality=92)


if __name__ == "__main__":
    main()
