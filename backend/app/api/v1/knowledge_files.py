import os
import json
import uuid
import io
import aiofiles
import subprocess
import tempfile
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from urllib.parse import quote
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.knowledge import Knowledge
from app.utils.watermark import apply_watermark
from app.utils.text_extract import extract_text_from_file
from app.services.search_service import SearchService

router = APIRouter(tags=["知识库文件"])

# Office 文件转 PDF 的工具路径
LIBREOFFICE_CMD = "/Users/guige/bin/libreoffice"

# 支持在线预览的文件类型
OFFICE_EXTS = {"doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"}
IMAGE_EXTS = {"png", "jpg", "jpeg", "gif", "bmp", "webp"}
PDF_EXT = "pdf"


def convert_to_pdf(file_path: str, output_dir: str) -> Optional[str]:
    """使用 LibreOffice 将 Office 文件转换为 PDF，返回 PDF 文件路径"""
    try:
        result = subprocess.run(
            [LIBREOFFICE_CMD, "--headless", "--convert-to", "pdf",
             "--outdir", output_dir, file_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            pdf_path = os.path.join(output_dir, base_name + ".pdf")
            if os.path.exists(pdf_path):
                return pdf_path
        return None
    except Exception as e:
        print(f"[CONVERT] Error converting to PDF: {e}")
        return None

UPLOAD_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "uploads", "knowledge")

# 支持上传的文件类型（最终都转为 PDF 存储）
ALLOWED_EXTS = {"pdf", "png", "jpg", "jpeg", "gif", "bmp", "webp"} | OFFICE_EXTS

# 图片类文件扩展名（不上传，保持原样）
IMAGE_EXTS_SET = {"png", "jpg", "jpeg", "gif", "bmp", "webp"}


def attachment_url(knowledge_id: str, filename: str) -> str:
    return f"/uploads/knowledge/{knowledge_id}/{filename}"


def content_disposition(filename: str, disposition: str = "inline") -> str:
    """生成支持非ASCII文件名的Content-Disposition头 (RFC 5987)"""
    # 用ASCII文件名作为fallback，用percent-encodedUTF-8作为filename*
    safe_ascii = "".join(c if ord(c) < 128 else "_" for c in filename)
    encoded = quote(filename, safe="")
    return f'{disposition}; filename="{safe_ascii}"; filename*=utf-8\'\'{encoded}'


def get_file_ext(filename: str) -> str:
    """获取文件扩展名（小写）"""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


@router.post("/{knowledge_id}/attachments", response_model=dict)
async def upload_attachment(
    knowledge_id: uuid.UUID,
    file: UploadFile = File(...),
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """上传文件到知识库（Office 文件自动转为 PDF，图片保持原样）"""
    # 检查知识库是否存在
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")

    filename = file.filename or "unknown"
    ext = get_file_ext(filename)

    # 检查文件类型是否允许
    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式 '{ext}'，仅支持 PDF、图片及 Office 文档（doc/docx/xls/xlsx/ppt/pptx）"
        )

    # 创建上传目录
    upload_dir = os.path.join(UPLOAD_BASE, str(knowledge_id))
    os.makedirs(upload_dir, exist_ok=True)

    # 生成安全文件名
    safe_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    # 读取上传的文件内容
    content = await file.read()

    # Office 文件需要转换为 PDF
    final_filename = filename
    final_ext = ext
    if ext in OFFICE_EXTS:
        print(f"[UPLOAD] Converting Office to PDF: {filename}")
        with tempfile.TemporaryDirectory() as tmp_dir:
            # 复制原文件到临时目录
            tmp_file = os.path.join(tmp_dir, filename)
            with open(tmp_file, "wb") as f:
                f.write(content)

            # 转换为 PDF
            pdf_path = convert_to_pdf(tmp_file, tmp_dir)
            if not pdf_path:
                raise HTTPException(status_code=400, detail=f"无法将 '{filename}' 转换为 PDF，请确保文件格式正确且未被损坏")

            # 读取转换后的 PDF
            with open(pdf_path, "rb") as f:
                content = f.read()

            # 改变文件名为 .pdf
            final_filename = filename.rsplit(".", 1)[0] + ".pdf"
            final_ext = "pdf"
            safe_filename = f"{uuid.uuid4().hex}_{final_filename}"
            file_path = os.path.join(upload_dir, safe_filename)

    # 保存文件
    with open(file_path, "wb") as f:
        f.write(content)

    # 更新附件列表
    attachments = (knowledge.attachments or [])[:]  # 创建副本避免原地修改检测问题
    attachment_info = {
        "filename": final_filename,
        "original_filename": filename if final_filename != filename else None,  # 记录原始文件名
        "url": attachment_url(str(knowledge_id), safe_filename),
        "size": len(content),
        "file_type": final_ext,  # 存储类型（pdf 或原类型）
        "upload_time": datetime.utcnow().isoformat(),
    }
    # 移除 None 值
    attachment_info = {k: v for k, v in attachment_info.items() if v is not None}
    attachments.append(attachment_info)
    knowledge.attachments = attachments
    await uow.flush()   # 确保 SQLAlchemy 检测到变更
    await uow.commit()

    # 提取文本并索引（仅 PDF 文件）
    try:
        content_text = extract_text_from_file(content, final_filename)
        SearchService.index_attachment(str(knowledge_id), attachment_info, content_text)
        print(f"[UPLOAD] Indexed attachment with {len(content_text)} chars of text")
    except Exception as e:
        print(f"[UPLOAD] Failed to index attachment: {e}")

    return attachment_info


@router.get("/{knowledge_id}/attachments", response_model=List[dict])
async def list_attachments(
    knowledge_id: uuid.UUID,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """获取附件列表"""
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")
    return knowledge.attachments or []


@router.delete("/{knowledge_id}/attachments/{filename}")
async def delete_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """删除附件"""
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")

    attachments = (knowledge.attachments or [])[:]
    # Find the attachment by original filename (first match)
    idx = None
    for i, att in enumerate(attachments):
        if att["filename"] == filename:
            idx = i
            break
    if idx is None:
        raise HTTPException(status_code=404, detail="附件不存在")

    # Extract safe filename from URL
    att = attachments[idx]
    safe_filename = att["url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_BASE, str(knowledge_id), safe_filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    # 从搜索索引中删除
    try:
        attachment_doc_id = f"{knowledge_id}_{att['filename']}"
        SearchService.get_client().index("attachments").delete_document(attachment_doc_id)
    except Exception as e:
        print(f"[DELETE] Failed to remove attachment from index: {e}")

    attachments.pop(idx)
    knowledge.attachments = attachments if attachments else None
    await uow.flush()   # 确保 SQLAlchemy 检测到变更
    await uow.commit()
    return {"message": "附件已删除"}


@router.get("/{knowledge_id}/attachments/{filename}")
async def preview_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    watermark: bool = Query(False, description="是否添加水印"),
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """预览附件（文件已在上架时转换为 PDF 或图片，直接预览；支持水印）"""
    print(f"[PREVIEW] knowledge_id={knowledge_id}, filename={repr(filename)}")
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")

    attachments = knowledge.attachments or []
    att = None
    for a in attachments:
        if a["filename"] == filename:
            att = a
            break
    if not att:
        raise HTTPException(status_code=404, detail="附件不存在")

    safe_filename = att["url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_BASE, str(knowledge_id), safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 读取文件内容
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # 根据 file_type 确定 MIME 类型
    file_type = att.get("file_type", get_file_ext(filename))
    mime_types = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "webp": "image/webp",
    }
    media_type = mime_types.get(file_type, "application/octet-stream")

    # 添加水印（仅对 PDF 和图片）
    if watermark and file_type in mime_types:
        file_bytes = apply_watermark(
            file_bytes, filename,
            username=current_user.full_name,
            date_str=datetime.now().strftime("%Y-%m-%d")
        )

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition(filename, "inline")},
    )


@router.get("/{knowledge_id}/attachments/{filename}/download")
async def download_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    watermark: bool = Query(False, description="是否添加水印"),
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """下载附件（支持水印）"""
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")

    attachments = knowledge.attachments or []
    att = None
    for a in attachments:
        if a["filename"] == filename:
            att = a
            break
    if not att:
        raise HTTPException(status_code=404, detail="附件不存在")

    safe_filename = att["url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_BASE, str(knowledge_id), safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 读取文件内容
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # 根据 file_type 确定 MIME 类型
    file_type = att.get("file_type", get_file_ext(filename))
    mime_types = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "webp": "image/webp",
    }
    media_type = mime_types.get(file_type, "application/octet-stream")

    # 下载文件名：优先使用原始文件名（如果文件是被转换过的）
    download_filename = att.get("original_filename") or filename

    if watermark:
        file_bytes = apply_watermark(
            file_bytes, download_filename,
            username=current_user.full_name,
            date_str=datetime.now().strftime("%Y-%m-%d")
        )
        # 水印后文件名加 _watermarked 后缀
        name_part = download_filename.rsplit(".", 1)
        if len(name_part) == 2:
            download_filename = f"{name_part[0]}_watermarked.{name_part[1]}"
        else:
            download_filename = f"{download_filename}_watermarked"

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition(download_filename, "attachment")},
    )
