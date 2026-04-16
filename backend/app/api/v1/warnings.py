from fastapi import APIRouter, Depends, Query
from fastapi import Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.warning import Warning
from app.schemas.common import PaginatedResponse, PageResult

router = APIRouter()


class WarningCreate(BaseModel):
    type: str
    title: str
    description: Optional[str] = None
    source_id: Optional[UUID] = None
    source_type: Optional[str] = None
    level: str = "warning"


@router.get("/", response_model=PaginatedResponse)
async def list_warnings(
    is_read: Optional[bool] = None,
    type: Optional[str] = None,
    level: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=9999),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List warnings with optional filters."""
    query = select(Warning)
    if is_read is not None:
        query = query.where(Warning.is_read == is_read)
    if type:
        query = query.where(Warning.type == type)
    if level:
        query = query.where(Warning.level == level)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(Warning.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse(
        data=PageResult(
            items=[
                {
                    "id": w.id,
                    "type": w.type,
                    "title": w.title,
                    "description": w.description,
                    "source_id": w.source_id,
                    "source_type": w.source_type,
                    "level": w.level,
                    "is_read": w.is_read,
                    "created_at": w.created_at.isoformat() if w.created_at else None,
                }
                for w in items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get count of unread warnings."""
    result = await db.execute(
        select(func.count()).select_from(Warning).where(Warning.is_read == False)
    )
    return {"count": result.scalar()}


@router.post("/{warning_id}/read")
async def mark_as_read(
    warning_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a warning as read."""
    result = await db.execute(select(Warning).where(Warning.id == warning_id))
    warning = result.scalar_one_or_none()
    if not warning:
        return {"message": "Warning not found"}

    warning.is_read = True
    warning.read_at = datetime.utcnow()
    warning.read_by = current_user.id
    await db.commit()
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all warnings as read."""
    await db.execute(
        update(Warning)
        .where(Warning.is_read == False)
        .values(is_read=True, read_at=datetime.utcnow(), read_by=current_user.id)
    )
    await db.commit()
    return {"message": "All warnings marked as read"}


@router.delete("/{warning_id}")
async def delete_warning(
    warning_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a warning."""
    result = await db.execute(select(Warning).where(Warning.id == warning_id))
    warning = result.scalar_one_or_none()
    if not warning:
        return {"message": "Warning not found"}

    await db.delete(warning)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/")
async def create_warning(
    warning_data: WarningCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new warning (used internally by the system)."""
    warning = Warning(
        type=warning_data.type,
        title=warning_data.title,
        description=warning_data.description,
        source_id=warning_data.source_id,
        source_type=warning_data.source_type,
        level=warning_data.level,
    )
    db.add(warning)
    await db.commit()
    await db.refresh(warning)
    return {
        "id": warning.id,
        "type": warning.type,
        "title": warning.title,
        "description": warning.description,
        "source_id": warning.source_id,
        "source_type": warning.source_type,
        "level": warning.level,
        "is_read": warning.is_read,
        "created_at": warning.created_at.isoformat() if warning.created_at else None,
    }
