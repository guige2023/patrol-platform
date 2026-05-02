from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID, uuid4
from pathlib import Path
import aiofiles
from app.dependencies import get_uow, get_current_user, require_permission
from app.database import UnitOfWork
from app.models.user import User
from app.core.audit import write_audit_log
from app.config import settings

router = APIRouter()

UPLOAD_DIR = Path(settings.RUNTIME_DIR) / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    entity_type: str = None,
    entity_id: UUID = None,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(require_permission("attachment:write")),
):
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

    # Stream in chunks to avoid loading huge files into memory at once
    content = b""
    while chunk := await file.read(65536):  # 64KB chunks
        if len(content) + len(chunk) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="文件大小超过限制（最大 50MB）")
        content += chunk

    # MIME type allowlist (optional client-provided type, we don't fully trust it)
    allowed_mime_types = {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.ms-excel",
        "text/plain", "text/csv",
    }
    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in allowed_mime_types and not mime_type.startswith("text/"):
        raise HTTPException(status_code=415, detail=f"不支持的文件类型: {mime_type}")

    file_id = uuid4()
    suffix = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{file_id}{suffix}"

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    
    from app.models.attachment import Attachment
    attachment = Attachment(
        entity_type=entity_type or "general",
        entity_id=entity_id,
        file_name=file.filename,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=file.content_type,
        uploaded_by=current_user.id,
    )
    uow.add(attachment)
    await uow.commit()
    await uow.refresh(attachment)
    
    return {"id": attachment.id, "file_name": file.filename}


def _check_file_access(uow: UnitOfWork, current_user: User, entity_type: str, entity_id: UUID) -> bool:
    """Check if user has access to the entity that owns this file."""
    # General and knowledge files are publicly accessible to all authenticated users
    if entity_type in ("general", "knowledge"):
        return True
    # super_admin has access to all files
    if getattr(current_user, 'role', None) == 'super_admin':
        return True
    # File owner always has access
    if entity_id and entity_id == current_user.id:
        return True
    # For entity-attached files, access is controlled by entity-level permissions
    # (entity_id refers to the parent entity, not the user)
    return False


@router.get("/{file_id}")
async def get_file_info(file_id: UUID, uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    from app.models.attachment import Attachment
    result = await uow.execute(select(Attachment).where(Attachment.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if not _check_file_access(uow, current_user, f.entity_type, f.entity_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"id": f.id, "file_name": f.file_name, "file_size": f.file_size, "mime_type": f.mime_type}


@router.get("/{file_id}/download")
async def download_file(file_id: UUID, uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    from app.models.attachment import Attachment
    result = await uow.execute(select(Attachment).where(Attachment.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if not _check_file_access(uow, current_user, f.entity_type, f.entity_id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Path traversal protection: ensure file is under UPLOAD_DIR
    real_upload = UPLOAD_DIR.resolve()
    try:
        real_path = Path(f.file_path).resolve()
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid file path")
    if not str(real_path).startswith(str(real_upload) + "/"):
        raise HTTPException(status_code=403, detail="Invalid file path")

    if not real_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(str(real_path), filename=f.file_name, media_type=f.mime_type)
