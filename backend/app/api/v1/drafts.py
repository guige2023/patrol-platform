from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.draft import Draft, DraftAttachment
from app.models.user import User
from app.schemas.draft import DraftCreate, DraftUpdate, DraftResponse, DraftSubmitRequest
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[DraftResponse])
async def list_drafts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    title: Optional[str] = None,
    status: Optional[str] = None,
    group_id: Optional[UUID] = None,
    unit_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Draft).where(Draft.is_active == True)
    if title:
        query = query.where(Draft.title.ilike(f"%{title}%"))
    if status:
        query = query.where(Draft.status == status)
    if group_id:
        query = query.where(Draft.group_id == group_id)
    if unit_id:
        query = query.where(Draft.unit_id == unit_id)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Draft.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(draft_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.post("/", response_model=DraftResponse, status_code=201)
async def create_draft(draft_data: DraftCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    draft = Draft(**draft_data.model_dump(), created_by=current_user.id)
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    await write_audit_log(db, current_user.id, "create", "draft", draft.id, {"title": draft.title})
    return draft


@router.put("/{draft_id}", response_model=DraftResponse)
async def update_draft(draft_id: UUID, draft_data: DraftUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    for key, value in draft_data.model_dump(exclude_unset=True).items():
        setattr(draft, key, value)
    await db.commit()
    await db.refresh(draft)
    await write_audit_log(db, current_user.id, "update", "draft", draft.id, {"title": draft.title})
    return draft


@router.post("/{draft_id}/submit")
async def submit_draft_action(draft_id: UUID, request: DraftSubmitRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    action = request.action
    if action == "submit":
        if draft.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft can be submitted")
        draft.status = "preliminary_review"
    elif action == "preliminary_review":
        if draft.status != "preliminary_review":
            raise HTTPException(status_code=400, detail="Wrong status")
        draft.preliminary_reviewer = current_user.id
        draft.preliminary_review_comment = request.comment
        draft.preliminary_review_at = func.now()
        draft.status = "final_review"
    elif action == "final_review":
        if draft.status != "final_review":
            raise HTTPException(status_code=400, detail="Wrong status")
        draft.final_reviewer = current_user.id
        draft.final_review_comment = request.comment
        draft.final_review_at = func.now()
        draft.status = "approved"
    elif action == "approve":
        draft.approved_by = current_user.id
        draft.approved_at = func.now()
        draft.status = "approved"
    elif action == "reject":
        draft.status = "rejected"
    
    await db.commit()
    await write_audit_log(db, current_user.id, f"draft_{action}", "draft", draft_id, {})
    return {"message": f"Draft {action} success", "status": draft.status}


@router.delete("/{draft_id}")
async def delete_draft(draft_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Draft).where(Draft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "draft", draft_id, {})
    return {"message": "Draft deleted"}
