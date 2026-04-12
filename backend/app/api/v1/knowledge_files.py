import os
import json
import uuid
import aiofiles
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.knowledge import Knowledge

router = APIRouter(prefix="/knowledge", tags=["知识库文件"])

UPLOAD_BASE = "backend/uploads/knowledge"


def attachment_url(knowledge_id: str, filename: str) -> str:
    return f"/uploads/knowledge/{knowledge_id}/{filename}"


@router.post("/{knowledge_id}/attachments", response_model=dict)
async def upload_attachment(
    knowledge_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """上传文件到知识库"""
    # 检查知识库是否存在
    result = await db.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")

    # 创建上传目录
    upload_dir = os.path.join(UPLOAD_BASE, str(knowledge_id))
    os.makedirs(upload_dir, exist_ok=True)

    # 生成安全文件名
    filename = file.filename or "unknown"
    safe_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    # 保存文件
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # 更新附件列表
    attachments = knowledge.attachments or []
    attachment_info = {
        "filename": filename,
        "url": attachment_url(str(knowledge_id), safe_filename),
        "size": len(content),
        "upload_time": datetime.utcnow().isoformat(),
    }
    attachments.append(attachment_info)
    knowledge.attachments = attachments
    await db.commit()

    return attachment_info


@router.get("/{knowledge_id}/attachments", response_model=List[dict])
async def list_attachments(
    knowledge_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取附件列表"""
    result = await db.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")
    return knowledge.attachments or []


@router.delete("/{knowledge_id}/attachments/{filename}")
async def delete_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除附件"""
    result = await db.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")

    attachments = knowledge.attachments or []
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

    attachments.pop(idx)
    knowledge.attachments = attachments if attachments else None
    await db.commit()
    return {"message": "附件已删除"}


@router.get("/{knowledge_id}/attachments/{filename}/download")
async def download_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下载附件"""
    result = await db.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
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

    return FileResponse(file_path, filename=filename)
