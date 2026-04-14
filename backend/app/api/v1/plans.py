from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.dependencies import get_db, get_current_user
from app.models.plan import Plan, PlanVersion, PlanStatus
from app.models.user import User
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[PlanResponse])
async def list_plans(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=9999),
    name: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Plan).where(Plan.is_active == True)
    if name:
        query = query.where(Plan.name.ilike(f"%{name}%"))
    if year:
        query = query.where(Plan.year == year)
    if status:
        query = query.where(Plan.status == status)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Plan.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.post("/", response_model=PlanResponse, status_code=201)
async def create_plan(plan_data: PlanCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = Plan(**plan_data.model_dump(), created_by=current_user.id)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    await write_audit_log(db, current_user.id, "create", "plan", plan.id, {"name": plan.name})
    return plan


@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(plan_id: UUID, plan_data: PlanUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    data = plan_data.model_dump(exclude_unset=True)
    if "status" in data and data["status"] != plan.status:
        version = plan.version_history or []
        version.append({"version": plan.version, "date": str(plan.updated_at), "change": f"Status: {plan.status} -> {data['status']}"})
        data["version_history"] = version
    
    for key, value in data.items():
        setattr(plan, key, value)
    
    await db.commit()
    await db.refresh(plan)
    await write_audit_log(db, current_user.id, "update", "plan", plan.id, {"name": plan.name})
    return plan


@router.post("/{plan_id}/submit")
async def submit_plan(plan_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.status != PlanStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Only draft plans can be submitted")
    plan.status = PlanStatus.SUBMITTED.value
    await db.commit()
    await write_audit_log(db, current_user.id, "submit", "plan", plan.id, {})
    return {"message": "Plan submitted for approval"}


@router.post("/{plan_id}/approve")
async def approve_plan(plan_id: UUID, comment: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.status != PlanStatus.SUBMITTED.value:
        raise HTTPException(status_code=400, detail="Only submitted plans can be approved")
    plan.status = PlanStatus.APPROVED.value
    plan.approved_by = current_user.id
    plan.approval_comment = comment
    await db.commit()
    await write_audit_log(db, current_user.id, "approve", "plan", plan.id, {})
    return {"message": "Plan approved"}


@router.post("/{plan_id}/publish")
async def publish_plan(plan_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from datetime import datetime
    from app.models.unit import Unit
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.status != PlanStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Only approved plans can be published")
    plan.status = PlanStatus.PUBLISHED.value

    # 自动更新被巡察单位的巡察年份和历史
    current_year = datetime.now().year
    updated_units = []
    for unit_id in (plan.target_units or []):
        unit_result = await db.execute(select(Unit).where(Unit.id == unit_id))
        unit = unit_result.scalar_one_or_none()
        if unit:
            unit.last_inspection_year = current_year
            existing = unit.inspection_history or ""
            round_info = f"{current_year}年{plan.round_name or ('%d轮' % plan.round)}"
            unit.inspection_history = (existing + f"; {round_info}").strip("; ")
            updated_units.append(unit.name)

    await db.commit()
    await write_audit_log(db, current_user.id, "publish", "plan", plan.id, {
        "target_units": plan.target_units,
        "updated_units": updated_units,
    })
    return {"message": f"Plan published，{len(updated_units)}个单位巡察记录已更新"}


@router.delete("/{plan_id}")
async def delete_plan(plan_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "plan", plan.id, {"name": plan.name})
    return {"message": "Plan deleted"}
