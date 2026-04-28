from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID, uuid4
from pathlib import Path
import aiofiles
from app.dependencies import get_uow, get_current_user
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
    current_user: User = Depends(get_current_user),
):
    file_id = uuid4()
    suffix = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{file_id}{suffix}"
    
    content = await file.read()
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
    if not Path(f.file_path).is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(f.file_path, filename=f.file_name, media_type=f.mime_type)
