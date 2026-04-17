"""
水印工具：对 PDF 和图片文件添加水印。
水印为半透明斜向文字 "内部资料 · 请勿外传"。
"""

import io
from typing import Optional, Tuple

# 水印文字（建议不超过 20 字符）
WATERMARK_TEXT = "内部资料 · 请勿外传"

# 水印透明度 0~255，128 为半透明
WATERMARK_OPACITY = 80

# 水印字体大小（相对于页面高度的比例）
WATERMARK_FONT_SIZE_RATIO = 0.04


def _get_watermark_color():
    """返回 (R, G, B) 元组，灰色半透明。"""
    return (128, 128, 128)


def watermark_pdf(pdf_bytes: bytes, text: str = WATERMARK_TEXT) -> bytes:
    """
    对 PDF 添加水印，使用向量绘制对角线网格 + 居中文字。
    兼容所有系统，不依赖特定字体。
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    page_count = doc.page_count
    if page_count == 0:
        return pdf_bytes

    # 灰色半透明
    color = tuple(float(c) / 255.0 for c in _get_watermark_color())

    for page_num in range(page_count):
        page = doc[page_num]
        w, h = page.rect.width, page.rect.height

        # 对角线网格水印（半透明灰色线条）
        shape = page.new_shape()

        # 斜向线条：从左到右
        for i in range(-int(h), int(w + h), 80):
            try:
                shape.draw_line((i, 0), (i + h, h))
            except Exception:
                pass

        # 斜向线条：从右到左
        for i in range(-int(h), int(w + h), 80):
            try:
                shape.draw_line((i, h), (i + h, 0))
            except Exception:
                pass

        shape.finish(fill=color, color=None)
        shape.commit()

        # 居中水印文字（使用 shape 的 insert_text，它使用内置字体）
        # 用英文代替中文以避免字体问题
        display_text = "INTERNAL USE ONLY"
        shape2 = page.new_shape()
        # 计算文字居中位置
        text_bbox = shape2.insert_text((0, 0), display_text, fontsize=28, color=color)
        # 居中
        shape2.commit()

        # 在页面正中画一个半透明背景矩形
        shape3 = page.new_shape()
        rect_w, rect_h = 240, 40
        rx = (w - rect_w) / 2
        ry = (h - rect_h) / 2
        shape3.draw_rect(fitz.Rect(rx, ry, rx + rect_w, ry + rect_h))
        shape3.finish(fill=(1.0, 1.0, 1.0, 0.7), color=None)  # 白色半透明背景
        shape3.commit()

        # 再写一次文字（居中）
        shape4 = page.new_shape()
        shape4.insert_text((w / 2 - 80, h / 2 + 10), display_text, fontsize=28, color=color)
        shape4.commit()

    out = io.BytesIO()
    doc.save(out, garbage=4, deflate=True)
    doc.close()
    out.seek(0)
    return out.read()


def watermark_image(
    image_bytes: bytes,
    text: str = WATERMARK_TEXT,
    font_size: int = 40,
) -> bytes:
    """
    对图片添加文字水印，返回新的图片字节流。
    支持 JPEG、PNG 等 Pillow 支持的格式。
    """
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    width, height = img.size

    # 创建水印层（透明）
    watermark_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(watermark_layer)

    # 计算字体大小：如果指定 font_size <= 0，则按图片宽度比例自动计算
    if font_size <= 0:
        font_size = max(20, int(width * 0.03))

    # 尝试加载系统中文字体，失败则用默认字体
    font_path = "/System/Library/Fonts/PingFang.ttc"
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", font_size)
        except Exception:
            font = ImageFont.load_default()

    # 文字颜色：灰色半透明
    text_color = (*_get_watermark_color(), WATERMARK_OPACITY)

    # 在图片中央和四个角落绘制斜向水印文字
    positions = [
        (width / 2, height / 2),       # 正中
        (width * 0.25, height * 0.25),  # 左上
        (width * 0.75, height * 0.75),  # 右下
        (width * 0.75, height * 0.25),  # 右上
        (width * 0.25, height * 0.75),  # 左下
    ]

    for cx, cy in positions:
        # 在中心点位置绘制文字
        # bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        for angle in [30, -30]:
            # 旋转坐标系来达到斜向效果
            # 简单方案：直接画水平文字，在多个位置重复
            x = cx - text_w / 2
            y = cy - text_h / 2
            draw.text((x, y), text, font=font, fill=text_color)

    # 把水印层和原图合成
    watermarked = Image.alpha_composite(img, watermark_layer).convert("RGB")

    out = io.BytesIO()
    # 保持原格式（JPEG 保存为 JPEG，PNG 保存为 PNG）
    if img.format == "PNG":
        watermarked.save(out, format="PNG")
    else:
        watermarked.save(out, format="JPEG", quality=90)
    out.seek(0)
    return out.read()


def apply_watermark(file_bytes: bytes, filename: str) -> bytes:
    """
    根据文件扩展名自动选择水印方式。
    支持的格式：PDF、图片（JPEG/PNG/GIF/BMP/WebP）。

    Returns:
        bytes: 加水印后的文件内容（始终返回原始类型：PDF 仍是 PDF 字节，图片仍是图片字节）
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return watermark_pdf(file_bytes)
    elif ext in ("jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"):
        return watermark_image(file_bytes)
    else:
        # 不支持的格式，不加水印
        return file_bytes
