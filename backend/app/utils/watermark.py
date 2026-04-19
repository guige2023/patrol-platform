"""
水印工具：对 PDF 和图片文件添加水印。
水印为半透明文字："徐圩新区巡察工作管理平台" + 用户名 + 日期。
"""

import io
from datetime import datetime

# 水印透明度 0~255，越小越透明
WATERMARK_OPACITY = 120

# 水印字体大小（PDF pt，图片 px）
# 注意：macOS中文字体渲染为细线条轮廓，需要足够大才能看清
WATERMARK_FONT_SIZE = 28


def _make_watermark_text(username: str, date_str: str) -> str:
    """生成水印文字，三行：机构名、用户名、日期"""
    return f"徐圩新区巡察工作管理平台\n{username}\n{date_str}"


def _get_watermark_color():
    """返回 (R, G, B) 元组，灰色"""
    return (80, 80, 80)


def _load_font(size: int):
    """加载中文字体，优先使用黑体（粗体）"""
    from PIL import ImageFont

    # 尝试多个字体路径，优先选择粗体
    font_paths = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/PingFang.ttc",
    ]

    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            continue

    return ImageFont.load_default()


def watermark_pdf(pdf_bytes: bytes, username: str, date_str: str) -> bytes:
    """对 PDF 添加水印"""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.page_count == 0:
        return pdf_bytes

    text = _make_watermark_text(username, date_str)
    color = tuple(float(c) / 255.0 for c in _get_watermark_color())

    for page_num in range(doc.page_count):
        page = doc[page_num]
        w, h = page.rect.width, page.rect.height
        for angle in [30, -30]:
            shape = page.new_shape()
            shape.insert_text(
                (w * 0.1, h * 0.5),
                text,
                fontsize=WATERMARK_FONT_SIZE,
                color=color,
            )
            shape.commit()

    out = io.BytesIO()
    doc.save(out, garbage=4, deflate=True)
    doc.close()
    out.seek(0)
    return out.read()


def watermark_image(
    image_bytes: bytes,
    username: str,
    date_str: str,
    font_size: int = WATERMARK_FONT_SIZE,
) -> bytes:
    """对图片添加文字水印"""
    from PIL import Image, ImageDraw

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    width, height = img.size

    watermark_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(watermark_layer)

    text = _make_watermark_text(username, date_str)
    font = _load_font(font_size)

    # 文字颜色：灰色半透明
    text_color = (*_get_watermark_color(), WATERMARK_OPACITY)

    # 计算文字居中位置
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    cx, cy = width / 2, height / 2
    x = cx - text_w / 2
    y = cy - text_h / 2

    # 多次绘制以增强可见性（macOS中文字体渲染为细线）
    for _ in range(3):
        draw.text((x, y), text, font=font, fill=text_color)

    # 合成
    watermarked = Image.alpha_composite(img, watermark_layer).convert("RGB")

    out = io.BytesIO()
    if img.format == "PNG":
        watermarked.save(out, format="PNG")
    else:
        watermarked.save(out, format="JPEG", quality=95)
    out.seek(0)
    return out.read()


def apply_watermark(file_bytes: bytes, filename: str, username: str = "未知用户", date_str: str = "") -> bytes:
    """根据文件扩展名自动选择水印方式"""
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return watermark_pdf(file_bytes, username, date_str)
    elif ext in ("jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"):
        return watermark_image(file_bytes, username, date_str, WATERMARK_FONT_SIZE)
    else:
        return file_bytes
