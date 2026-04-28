"""
水印工具：对 PDF 和图片文件添加水印。
水印为半透明文字："徐圩新区巡察工作管理平台" + 用户名 + 日期。
"""

import io
from datetime import datetime

# 水印透明度 0~255，越小越透明
WATERMARK_OPACITY = 120

# 水印字体大小（图片 px）
# 注意：macOS中文字体渲染为细线条轮廓，需要足够大才能看清
WATERMARK_FONT_SIZE = 28

# PDF水印参数
PDF_WATERMARK_SIZE = 28


def _make_watermark_text(username: str, date_str: str) -> str:
    """生成水印文字，三行：机构名、用户名、日期"""
    return f"徐圩新区巡察工作管理平台\n{username}\n{date_str}"


def _get_watermark_color():
    """返回 (R, G, B) 元组，灰色"""
    return (80, 80, 80)


def _load_font(size: int):
    """加载中文字体，优先使用黑体（粗体）"""
    from PIL import ImageFont

    font_paths = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
    ]

    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            continue

    return ImageFont.load_default()


def _render_watermark_png(text: str, font_size: int) -> bytes:
    """用PIL渲染水印文字为PNG图片（支持中文），返回PNG字节"""
    from PIL import Image, ImageDraw

    font = _load_font(font_size)
    color = _get_watermark_color()

    # 先测量文字尺寸
    dummy = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
    draw = ImageDraw.Draw(dummy)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    padding = 20
    img_w = text_w + padding * 2
    img_h = text_h + padding * 2

    # 创建透明背景的RGBA图片
    wm_img = Image.new('RGBA', (max(img_w, 1), max(img_h, 1)), (0, 0, 0, 0))
    draw2 = ImageDraw.Draw(wm_img)

    # 多次绘制以增强macOS中文字体可见性
    text_color = (*color, WATERMARK_OPACITY)
    for _ in range(3):
        draw2.text((padding, padding), text, font=font, fill=text_color)

    # 转PNG bytes
    buf = io.BytesIO()
    wm_img.save(buf, format='PNG')
    return buf.getvalue()


def watermark_pdf(pdf_bytes: bytes, username: str, date_str: str) -> bytes:
    """对 PDF 添加水印：把中文水印渲染为PNG，插入到PDF每一页"""
    import fitz

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        # 文件不是有效的 PDF，返回原始内容（避免因测试文件导致 500 错误）
        print(f"[WATERMARK] Invalid PDF, skipping watermark: {e}")
        return pdf_bytes
    if doc.page_count == 0:
        return pdf_bytes

    text = _make_watermark_text(username, date_str)
    wm_png = _render_watermark_png(text, PDF_WATERMARK_SIZE)

    for page_num in range(doc.page_count):
        page = doc[page_num]
        page_w = page.rect.width
        page_h = page.rect.height

        # 计算水印图片在页面上的居中位置
        from PIL import Image
        wm_img = Image.open(io.BytesIO(wm_png))
        wm_w, wm_h = wm_img.size

        x = (page_w - wm_w) / 2
        y = (page_h - wm_h) / 2
        rect = fitz.Rect(x, y, x + wm_w, y + wm_h)

        # 插入水印图片（overlay=True表示叠加在原有内容之上）
        page.insert_image(rect, stream=wm_png, overlay=True)

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

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    except Exception as e:
        # 文件不是有效的图片，返回原始内容
        print(f"[WATERMARK] Invalid image, skipping watermark: {e}")
        return image_bytes
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
