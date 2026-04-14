from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional, List
from app.dependencies import get_db, get_current_user
from app.models.clue import Clue
from app.models.user import User
from app.schemas.clue import ClueCreate, ClueUpdate, ClueTransfer, ClueResponse
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[ClueResponse])
async def list_clues(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=9999),
    title: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Clue)
    if title:
        query = query.where(Clue.title.ilike(f"%{title}%"))
    if status:
        query = query.where(Clue.status == status)
    if source:
        query = query.where(Clue.source == source)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Clue.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{clue_id}", response_model=ClueResponse)
async def get_clue(clue_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalar_one_or_none()
    if not clue:
        raise HTTPException(status_code=404, detail="Clue not found")
    return clue


@router.post("/", response_model=ClueResponse, status_code=201)
async def create_clue(clue_data: ClueCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    clue = Clue(**clue_data.model_dump(), registered_by=current_user.id)
    db.add(clue)
    await db.commit()
    await db.refresh(clue)
    await write_audit_log(db, current_user.id, "create", "clue", clue.id, {"title": clue.title})
    return clue


@router.put("/{clue_id}", response_model=ClueResponse)
async def update_clue(clue_id: UUID, clue_data: ClueUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalar_one_or_none()
    if not clue:
        raise HTTPException(status_code=404, detail="Clue not found")
    for key, value in clue_data.model_dump(exclude_unset=True).items():
        setattr(clue, key, value)
    await db.commit()
    await db.refresh(clue)
    await write_audit_log(db, current_user.id, "update", "clue", clue_id, {})
    return clue


@router.post("/{clue_id}/transfer")
async def transfer_clue(clue_id: UUID, body: ClueTransfer = Body(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Clue).where(Clue.id == clue_id))
    clue = result.scalar_one_or_none()
    if not clue:
        raise HTTPException(status_code=404, detail="Clue not found")
    clue.status = "transferred"
    clue.transfer_target = body.target
    clue.transfer_date = func.now()
    clue.transfer_comment = body.comment
    await db.commit()
    await write_audit_log(db, current_user.id, "transfer", "clue", clue_id, {"target": body.target})
    return {"message": "Clue transferred"}
