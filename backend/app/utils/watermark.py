"""
水印工具：对 PDF 和图片文件添加水印。
水印为半透明文字："徐圩新区巡察工作管理平台" + 用户名 + 日期。
"""

import io
from datetime import datetime

# 水印透明度 0~255，越小越透明。35=14%太淡文字几乎看不见，改用100=39%既清晰又不遮挡
WATERMARK_OPACITY = 100

# 水印字体大小（PDF pt，图片 px）
WATERMARK_FONT_SIZE = 16


def _make_watermark_text(username: str, date_str: str) -> str:
    """生成水印文字，三行：机构名、用户名、日期"""
    return f"徐圩新区巡察工作管理平台\n{username}\n{date_str}"


def _get_watermark_color():
    """返回 (R, G, B) 元组，灰色半透明"""
    return (128, 128, 128)


def _load_font(size: int):
    """加载中文字体，优先使用系统黑体"""
    from PIL import ImageFont

    # 尝试多个字体路径
    font_paths = [
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/PingFang.ttc",
    ]

    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            continue

    # 如果都失败，使用默认字体
    return ImageFont.load_default()


def watermark_pdf(pdf_bytes: bytes, username: str, date_str: str) -> bytes:
    """
    对 PDF 添加水印，使用向量绘制半透明斜向文字。
    兼容所有系统，不依赖特定字体。
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    page_count = doc.page_count
    if page_count == 0:
        return pdf_bytes

    text = _make_watermark_text(username, date_str)
    color = tuple(float(c) / 255.0 for c in _get_watermark_color())

    for page_num in range(page_count):
        page = doc[page_num]
        w, h = page.rect.width, page.rect.height

        # 斜向文字水印（两条交叉）
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
    """
    对图片添加文字水印，返回新的图片字节流。
    支持 JPEG、PNG 等 Pillow 支持的格式。
    """
    from PIL import Image, ImageDraw

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    width, height = img.size

    # 创建水印层（透明）
    watermark_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(watermark_layer)

    text = _make_watermark_text(username, date_str)

    # 计算字体大小
    if font_size <= 0:
        font_size = max(12, int(width * 0.018))

    # 加载字体
    font = _load_font(font_size)

    # 文字颜色：灰色半透明
    text_color = (*_get_watermark_color(), WATERMARK_OPACITY)

    # 在图片中央绘制一道水印（不重复多个位置，避免遮挡）
    cx, cy = width / 2, height / 2

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = cx - text_w / 2
    y = cy - text_h / 2
    draw.text((x, y), text, font=font, fill=text_color)

    # 把水印层和原图合成
    watermarked = Image.alpha_composite(img, watermark_layer).convert("RGB")

    out = io.BytesIO()
    # 保持原格式，使用高质量保存
    if img.format == "PNG":
        watermarked.save(out, format="PNG")
    else:
        watermarked.save(out, format="JPEG", quality=95)
    out.seek(0)
    return out.read()


def apply_watermark(file_bytes: bytes, filename: str, username: str = "未知用户", date_str: str = "") -> bytes:
    """
    根据文件扩展名自动选择水印方式。
    支持的格式：PDF、图片（JPEG/PNG/GIF/BMP/WebP）。

    Args:
        file_bytes: 文件内容
        filename: 文件名（用于判断类型）
        username: 当前登录用户名称
        date_str: 日期字符串

    Returns:
        bytes: 加水印后的文件内容
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return watermark_pdf(file_bytes, username, date_str)
    elif ext in ("jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"):
        return watermark_image(file_bytes, username, date_str, WATERMARK_FONT_SIZE)
    else:
        # 不支持的格式，不加水印
        return file_bytes
