from __future__ import annotations

from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT / "docs" / "images"
PUBLIC_DIR = ROOT / "docs-site" / "public"

GREEN = (16, 185, 129)
CYAN = (34, 211, 238)
LIME = (110, 231, 183)
DARK = (6, 12, 14)
TEXT = (220, 255, 240)
MUTED = (150, 210, 190)


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
            "/System/Library/Fonts/Supplemental/Helvetica Neue.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Helvetica.ttf",
            "/Library/Fonts/Arial.ttf",
        ]

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_text_glow(base: Image.Image, position: Tuple[int, int], text: str, font: ImageFont.FreeTypeFont) -> None:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.text(position, text, font=font, fill=(*CYAN, 130))
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    base.alpha_composite(glow)
    draw = ImageDraw.Draw(base)
    draw.text((position[0] + 2, position[1] + 2), text, font=font, fill=(0, 0, 0, 160))
    draw.text(position, text, font=font, fill=(*TEXT, 255))


def draw_grid(base: Image.Image, spacing: int, color: Tuple[int, int, int], alpha: int) -> None:
    grid = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grid)
    width, height = base.size
    for x in range(0, width, spacing):
        gdraw.line([(x, 0), (x, height)], fill=(*color, alpha))
    for y in range(0, height, spacing):
        gdraw.line([(0, y), (width, y)], fill=(*color, alpha))
    base.alpha_composite(grid)


def render_logo() -> Image.Image:
    size = 1024
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    center = size // 2

    for i in range(10):
        radius = 470 + i * 6
        alpha = max(0, 90 - i * 8)
        draw.ellipse(
            (center - radius, center - radius, center + radius, center + radius),
            outline=(*CYAN, alpha),
            width=3,
        )

    draw.ellipse((center - 460, center - 460, center + 460, center + 460), outline=(*GREEN, 220), width=10)
    draw.ellipse((center - 430, center - 430, center + 430, center + 430), fill=(*DARK, 235), outline=(*CYAN, 160), width=6)

    grid = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_grid(grid, 40, GREEN, 26)
    mask = Image.new("L", base.size, 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse((center - 420, center - 420, center + 420, center + 420), fill=200)
    base.paste(grid, (0, 0), mask)

    halo = Image.new("RGBA", base.size, (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(halo)
    hdraw.ellipse((center - 380, center - 380, center + 380, center + 380), outline=(*LIME, 120), width=2)
    halo = halo.filter(ImageFilter.GaussianBlur(6))
    base.alpha_composite(halo)

    for angle in (20, 160, 260):
        import math

        r = 430
        x = center + int(r * math.cos(math.radians(angle)))
        y = center + int(r * math.sin(math.radians(angle)))
        draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=(*CYAN, 200), outline=(255, 255, 255, 100), width=2)

    title_font = load_font(170)
    subtitle_font = load_font(46, mono=True)
    draw_text_glow(base, (center - 160, center - 140), "MS", title_font)
    draw_text_glow(base, (center - 190, center + 120), "MEDIA STACK", subtitle_font)

    return base


def render_storage_planning() -> Image.Image:
    width, height = 1600, 1000
    base = Image.new("RGBA", (width, height), (5, 10, 12, 255))
    draw_grid(base, 80, GREEN, 20)

    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((200, 100, 800, 700), fill=(*GREEN, 60))
    gdraw.ellipse((900, 120, 1450, 680), fill=(*CYAN, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    base.alpha_composite(glow)

    title_font = load_font(46)
    sub_font = load_font(26)
    draw_text_glow(base, (340, 32), "Storage Planning: Bitrate -> Disk", title_font)
    draw_text_glow(base, (420, 86), "(includes HEVC efficiency rule of thumb)", sub_font)

    chart_left, chart_top = 140, 190
    chart_right, chart_bottom = 1460, 760
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(
        (chart_left, chart_top, chart_right, chart_bottom),
        radius=26,
        fill=(8, 14, 16, 220),
        outline=(*CYAN, 100),
        width=2,
    )

    grid_font = load_font(22, mono=True)
    max_val = 2.0
    for i in range(5):
        val = i * 0.5
        y = chart_bottom - int((val / max_val) * (chart_bottom - chart_top - 80)) - 40
        draw.line([(chart_left + 60, y), (chart_right - 40, y)], fill=(80, 160, 150, 60), width=2)
        draw.text((chart_left + 10, y - 12), f"{val:.1f}", font=grid_font, fill=(*MUTED, 220))

    labels = [5, 10, 20, 40]
    h264 = [0.23, 0.45, 0.90, 1.80]
    h265 = [0.11, 0.23, 0.45, 0.90]

    bar_width = 70
    gap = 90
    start_x = chart_left + 140
    for idx, label in enumerate(labels):
        group_x = start_x + idx * gap * 3
        x1 = group_x
        x2 = group_x + bar_width + 16
        for series, color, data in [
            ("H.264", CYAN, h264),
            ("H.265", GREEN, h265),
        ]:
            value = data[idx]
            bar_h = int((value / max_val) * (chart_bottom - chart_top - 80))
            y1 = chart_bottom - 40 - bar_h
            rect = (x1, y1, x1 + bar_width, chart_bottom - 40)
            bar_glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
            bdraw = ImageDraw.Draw(bar_glow)
            bdraw.rounded_rectangle(rect, radius=10, fill=(*color, 180))
            bar_glow = bar_glow.filter(ImageFilter.GaussianBlur(8))
            base.alpha_composite(bar_glow)
            draw.rounded_rectangle(rect, radius=10, fill=(*color, 200), outline=(255, 255, 255, 80), width=2)
            draw.text((x1 + 6, y1 - 26), f"{value:.2f}", font=grid_font, fill=(*TEXT, 240))
            x1 = x2

        draw.text((group_x + 10, chart_bottom - 24), f"{label} Mbps", font=grid_font, fill=(*MUTED, 240))

    legend_x, legend_y = chart_left + 70, chart_top + 40
    draw.rectangle((legend_x, legend_y, legend_x + 24, legend_y + 24), fill=(*CYAN, 200))
    draw.text((legend_x + 36, legend_y - 2), "H.264/AVC (baseline)", font=sub_font, fill=(*TEXT, 240))
    draw.rectangle((legend_x, legend_y + 34, legend_x + 24, legend_y + 58), fill=(*GREEN, 200))
    draw.text((legend_x + 36, legend_y + 32), "H.265/HEVC (~1/2 bitrate)", font=sub_font, fill=(*TEXT, 240))

    footer_font = load_font(22)
    draw.text(
        (220, 820),
        "Rule of thumb: 1 Mbps ~ 0.45 GB/hour (H.264). HEVC often needs ~50% of AVC.",
        font=footer_font,
        fill=(*MUTED, 220),
    )

    return base


def render_svg_export_demo() -> Image.Image:
    width, height = 768, 768
    base = Image.new("RGBA", (width, height), (6, 10, 12, 255))
    draw_grid(base, 64, GREEN, 16)

    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((80, 80, 520, 520), fill=(*GREEN, 60))
    gdraw.ellipse((320, 120, 720, 640), fill=(*CYAN, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    base.alpha_composite(glow)

    draw = ImageDraw.Draw(base)
    card = (70, 200, 698, 520)
    draw.rounded_rectangle(card, radius=26, fill=(8, 14, 16, 230), outline=(*CYAN, 120), width=2)
    draw.rounded_rectangle((card[0] + 12, card[1] + 12, card[2] - 12, card[3] - 12), radius=20, outline=(*GREEN, 80), width=1)

    header_font = load_font(22, mono=True)
    body_font = load_font(24)
    draw.text((110, 230), "Category", font=header_font, fill=(*MUTED, 230))
    draw.text((310, 230), "Path", font=header_font, fill=(*MUTED, 230))
    draw.text((560, 230), "Actions", font=header_font, fill=(*MUTED, 230))

    row_y = 300
    draw.rounded_rectangle((100, row_y, 670, row_y + 90), radius=18, fill=(10, 18, 20, 220), outline=(*GREEN, 120), width=2)
    draw.text((120, row_y + 28), "Movies", font=body_font, fill=(*TEXT, 240))
    draw.text((300, row_y + 28), "/mnt/media/movies", font=body_font, fill=(*TEXT, 220))

    btn_center = (595, row_y + 45)
    draw.ellipse((btn_center[0] - 26, btn_center[1] - 26, btn_center[0] + 26, btn_center[1] + 26), fill=(*CYAN, 200))
    draw.ellipse((btn_center[0] - 22, btn_center[1] - 22, btn_center[0] + 22, btn_center[1] + 22), fill=(8, 16, 18, 230), outline=(*CYAN, 160), width=2)
    draw.line((btn_center[0], btn_center[1] - 10, btn_center[0], btn_center[1] + 8), fill=(*CYAN, 240), width=3)
    draw.polygon(
        [
            (btn_center[0] - 8, btn_center[1] + 4),
            (btn_center[0] + 8, btn_center[1] + 4),
            (btn_center[0], btn_center[1] + 14),
        ],
        fill=(*CYAN, 240),
    )

    label_font = load_font(20)
    draw.rounded_rectangle((540, row_y + 100, 680, row_y + 140), radius=14, fill=(8, 14, 16, 230), outline=(*CYAN, 120), width=2)
    draw.text((552, row_y + 110), "Export SVG", font=label_font, fill=(*TEXT, 240))

    return base


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    logo = render_logo()
    logo.save(DOCS_DIR / "logo.png")
    logo.save(PUBLIC_DIR / "media-stack-logo.png")

    storage = render_storage_planning().convert("RGB")
    storage.save(DOCS_DIR / "storage_planning.jpg", quality=92)

    svg_demo = render_svg_export_demo()
    svg_demo.save(DOCS_DIR / "svg_export_demo.png")


if __name__ == "__main__":
    main()
