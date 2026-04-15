"""Slider puzzle captcha — image generation and trajectory validation."""

import base64
import io
import secrets
from pathlib import Path
from random import choice, randint

from PIL import Image, ImageChops, ImageDraw, ImageFilter

CAPTCHA_BACKGROUND_DIR = (
    Path(__file__).resolve().parents[1] / "assets" / "captcha" / "backgrounds"
)
CAPTCHA_WIDTH = 320
CAPTCHA_HEIGHT = 200
CAPTCHA_PIECE_SIZE = 56
CAPTCHA_EXPIRE_SECONDS = 300
CAPTCHA_TOLERANCE = 8

_PIECE_MARGIN = 5
_POLY_BLUR = 5
_POLY_THRESHOLD = 128
_GLOW_RADIUS = 3


def _load_random_background() -> Image.Image:
    """Load a random background image and resize to standard dimensions."""
    files = (
        [
            p
            for p in CAPTCHA_BACKGROUND_DIR.iterdir()
            if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        if CAPTCHA_BACKGROUND_DIR.exists()
        else []
    )
    if not files:
        raise RuntimeError("Captcha background images missing")

    picked = secrets.choice(files)
    img = (
        Image.open(picked)
        .convert("RGB")
        .resize((CAPTCHA_WIDTH, CAPTCHA_HEIGHT), Image.Resampling.LANCZOS)
    )
    return img


def _build_piece_mask(size: int) -> Image.Image:
    """Build a random shape mask (square/circle/triangle/parallelogram) with rounded edges."""
    shape = choice(["square", "circle", "triangle", "parallelogram"])
    m = _PIECE_MARGIN
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    inner = (m, m, size - m - 1, size - m - 1)
    sq_r = max(6, size // 9)

    if shape == "square":
        draw.rounded_rectangle(inner, radius=sq_r, fill=255)
    elif shape == "circle":
        draw.ellipse(inner, fill=255)
    elif shape == "triangle":
        pts = [(size // 2, m), (size - m, size - m), (m, size - m)]
        draw.polygon(pts, fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(radius=_POLY_BLUR))
        mask = mask.point(lambda v: 255 if v > _POLY_THRESHOLD else 0)
    else:  # parallelogram
        skew = (size - 2 * m) // 4
        pts = [
            (m + skew, m),
            (size - m, m),
            (size - m - skew, size - m),
            (m, size - m),
        ]
        draw.polygon(pts, fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(radius=_POLY_BLUR))
        mask = mask.point(lambda v: 255 if v > _POLY_THRESHOLD else 0)

    return mask


def _add_piece_glow(
    piece: Image.Image, mask: Image.Image, size: int
) -> Image.Image:
    """Add a white border and outer glow effect to the puzzle piece."""
    eroded = mask.filter(ImageFilter.MinFilter(3))
    border_ring = ImageChops.subtract(mask, eroded)
    border_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    border_layer.paste((255, 255, 255, 200), mask=border_ring)

    blurred = mask.filter(ImageFilter.GaussianBlur(radius=_GLOW_RADIUS))
    outer_glow = ImageChops.subtract(blurred, mask)
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_layer.paste((255, 255, 255, 150), mask=outer_glow)

    result = Image.alpha_composite(glow_layer, piece)
    return Image.alpha_composite(result, border_layer)


def _to_data_uri(img: Image.Image) -> str:
    """Convert a PIL Image to a base64 data URI string."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{data}"


def build_slide_images() -> tuple[str, str, int, int]:
    """Build the captcha background (with hole) and puzzle piece images.

    Returns (image_data_uri, thumb_data_uri, x, y).
    """
    image = _load_random_background()
    x = randint(80, CAPTCHA_WIDTH - CAPTCHA_PIECE_SIZE - 20)
    y = randint(20, CAPTCHA_HEIGHT - CAPTCHA_PIECE_SIZE - 20)

    mask = _build_piece_mask(CAPTCHA_PIECE_SIZE)

    piece = image.crop(
        (x, y, x + CAPTCHA_PIECE_SIZE, y + CAPTCHA_PIECE_SIZE)
    ).convert("RGBA")
    piece.putalpha(mask)
    piece = _add_piece_glow(piece, mask, CAPTCHA_PIECE_SIZE)

    bg = image.convert("RGBA")
    dim = Image.new(
        "RGBA", (CAPTCHA_PIECE_SIZE, CAPTCHA_PIECE_SIZE), (0, 0, 0, 95)
    )
    outline = Image.new(
        "RGBA", (CAPTCHA_PIECE_SIZE, CAPTCHA_PIECE_SIZE), (255, 255, 255, 36)
    )
    bg.paste(dim, (x, y), mask)
    bg.paste(outline, (x, y), mask)

    return _to_data_uri(bg), _to_data_uri(piece), x, y


def validate_trajectory(points: list, expected_x: int, tolerance: int) -> str:
    """Validate slider trajectory.

    Returns an empty string on success, or a failure reason message.
    """
    if len(points) < 3:
        return "轨迹数据不足，请重试"

    final_x = points[-1].x
    if abs(final_x - expected_x) > tolerance:
        return "滑块位置不正确，请重试"

    duration_ms = points[-1].t - points[0].t
    if duration_ms < 120:
        return "操作速度异常，请重试"
    if duration_ms > 30000:
        return "操作超时，请重试"

    if abs(points[-1].x - points[0].x) < 10:
        return "滑块位置不正确，请重试"

    speeds: list[float] = []
    for i in range(1, len(points)):
        dt = points[i].t - points[i - 1].t
        if dt > 0:
            speeds.append(abs(points[i].x - points[i - 1].x) / dt)

    if len(speeds) < 2:
        return "轨迹异常，请重试"

    avg_speed = sum(speeds) / len(speeds)
    if avg_speed <= 0:
        return "轨迹异常，请重试"

    if len(speeds) >= 8:
        variance = sum((s - avg_speed) ** 2 for s in speeds) / len(speeds)
        cv = variance**0.5 / avg_speed
        if cv < 0.08:
            return "轨迹异常，请重试"

    return ""
