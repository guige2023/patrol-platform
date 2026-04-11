from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.unit import Unit
from app.models.user import User
from app.schemas.unit import UnitCreate, UnitUpdate, UnitResponse, UnitTreeResponse
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log

router = APIRouter()


def build_unit_tree(units: List[Unit], parent_id: Optional[UUID] = None) -> List[UnitTreeResponse]:
    tree = []
    for unit in units:
        if unit.parent_id == parent_id:
            children = build_unit_tree(units, unit.id)
            resp = UnitTreeResponse(
                id=unit.id,
                name=unit.name,
                org_code=unit.org_code,
                parent_id=unit.parent_id,
                unit_type=unit.unit_type,
                level=unit.level,
                sort_order=unit.sort_order,
                tags=unit.tags or [],
                profile=unit.profile,
                leadership=unit.leadership,
                contact=unit.contact,
                is_active=unit.is_active,
                created_at=unit.created_at,
                children=children,
            )
            tree.append(resp)
    return tree


@router.get("/tree", response_model=List[UnitTreeResponse])
async def get_unit_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Unit).where(Unit.is_active == True).order_by(Unit.sort_order))
    units = result.scalars().all()
    return build_unit_tree(list(units))


@router.get("/", response_model=PaginatedResponse[UnitResponse])
async def list_units(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    name: Optional[str] = None,
    unit_type: Optional[str] = None,
    parent_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Unit)
    if name:
        query = query.where(Unit.name.ilike(f"%{name}%"))
    if unit_type:
        query = query.where(Unit.unit_type == unit_type)
    if parent_id:
        query = query.where(Unit.parent_id == parent_id)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Unit.sort_order).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{unit_id}", response_model=UnitResponse)
async def get_unit(unit_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Unit).where(Unit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.post("/", response_model=UnitResponse, status_code=201)
async def create_unit(unit_data: UnitCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = Unit(**unit_data.model_dump())
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    await write_audit_log(db, current_user.id, "create", "unit", unit.id, {"name": unit.name})
    return unit


@router.put("/{unit_id}", response_model=UnitResponse)
async def update_unit(unit_id: UUID, unit_data: UnitUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Unit).where(Unit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    for key, value in unit_data.model_dump(exclude_unset=True).items():
        setattr(unit, key, value)
    await db.commit()
    await db.refresh(unit)
    await write_audit_log(db, current_user.id, "update", "unit", unit.id, {"name": unit.name})
    return unit


@router.delete("/{unit_id}")
async def delete_unit(unit_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Unit).where(Unit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    unit.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "unit", unit.id, {"name": unit.name})
    return {"message": "Unit deleted"}
