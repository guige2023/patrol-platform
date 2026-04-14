from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.rectification import Rectification
from app.models.user import User
from app.schemas.rectification import RectificationCreate, RectificationUpdate, RectificationResponse
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[RectificationResponse])
async def list_rectifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=9999),
    title: Optional[str] = None,
    status: Optional[str] = None,
    unit_id: Optional[UUID] = None,
    alert_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Rectification).where(Rectification.is_active == True)
    if title:
        query = query.where(Rectification.title.ilike(f"%{title}%"))
    if status:
        query = query.where(Rectification.status == status)
    if unit_id:
        query = query.where(Rectification.unit_id == unit_id)
    if alert_level:
        query = query.where(Rectification.alert_level == alert_level)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Rectification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{rect_id}", response_model=RectificationResponse)
async def get_rectification(rect_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    return rect


@router.post("/", response_model=RectificationResponse, status_code=201)
async def create_rectification(rect_data: RectificationCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    rect = Rectification(**rect_data.model_dump(), created_by=current_user.id)
    db.add(rect)
    await db.commit()
    await db.refresh(rect)
    await write_audit_log(db, current_user.id, "create", "rectification", rect.id, {"title": rect.title})
    return rect


@router.put("/{rect_id}", response_model=RectificationResponse)
async def update_rectification(rect_id: UUID, rect_data: RectificationUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    for key, value in rect_data.model_dump(exclude_unset=True).items():
        setattr(rect, key, value)
    await db.commit()
    await db.refresh(rect)
    await write_audit_log(db, current_user.id, "update", "rectification", rect_id, {})
    return rect


@router.patch("/{rect_id}/progress")
async def update_progress(rect_id: UUID, progress: int, details: Optional[List[dict]] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.progress = max(0, min(100, progress))
    if details:
        rect.progress_details = details
    if rect.progress >= 100:
        rect.status = "completed"
        rect.completion_date = func.now()
    await db.commit()
    await write_audit_log(db, current_user.id, "update_progress", "rectification", rect_id, {"progress": progress})
    return {"message": "Progress updated"}


@router.post("/{rect_id}/sign")
async def sign_rectification(rect_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.status = "progressing"
    rect.sign_date = func.now()
    rect.sign_by = current_user.id
    await db.commit()
    await write_audit_log(db, current_user.id, "sign", "rectification", rect_id, {})
    return {"message": "Rectification signed"}


@router.post("/{rect_id}/verify")
async def verify_rectification(rect_id: UUID, comment: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.status = "verified"
    rect.verified_by = current_user.id
    rect.verified_at = func.now()
    rect.verification_comment = comment
    await db.commit()
    await write_audit_log(db, current_user.id, "verify", "rectification", rect_id, {})
    return {"message": "Rectification verified"}
