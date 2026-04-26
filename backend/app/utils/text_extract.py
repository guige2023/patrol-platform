"""
PDF 文本提取工具 - 用于全文搜索索引
"""

import io


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """从 PDF 中提取文本内容"""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception as e:
        print(f"[TEXT_EXTRACT] Error extracting text from PDF: {e}")
        return ""


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """根据文件类型提取文本"""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)

    # 其他格式暂不支持文本提取
    return ""
