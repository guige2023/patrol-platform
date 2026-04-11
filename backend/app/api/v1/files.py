from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
from pathlib import Path
import aiofiles
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.core.audit import write_audit_log

router = APIRouter()

UPLOAD_DIR = Path("/tmp/patrol_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    entity_type: str = None,
    entity_id: UUID = None,
    db: AsyncSession = Depends(get_db),
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
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    
    return {"id": attachment.id, "file_name": file.filename}


@router.get("/{file_id}")
async def get_file_info(file_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.attachment import Attachment
    result = await db.execute(select(Attachment).where(Attachment.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return {"id": f.id, "file_name": f.file_name, "file_size": f.file_size, "mime_type": f.mime_type}


@router.get("/{file_id}/download")
async def download_file(file_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.attachment import Attachment
    result = await db.execute(select(Attachment).where(Attachment.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(f.file_path, filename=f.file_name, media_type=f.mime_type)
