from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.cadre import Cadre
from app.models.user import User
from app.schemas.cadre import CadreCreate, CadreUpdate, CadreResponse
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log
from app.core.encryption import encrypt_field, decrypt_field, mask_id_card

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[CadreResponse])
async def list_cadres(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    name: Optional[str] = None,
    unit_id: Optional[UUID] = None,
    tags: Optional[str] = None,
    is_available: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Cadre).where(Cadre.is_active == True)
    if name:
        query = query.where(Cadre.name.ilike(f"%{name}%"))
    if unit_id:
        query = query.where(Cadre.unit_id == unit_id)
    if is_available is not None:
        query = query.where(Cadre.is_available == is_available)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Cadre.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{cadre_id}", response_model=CadreResponse)
async def get_cadre(cadre_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Cadre).where(Cadre.id == cadre_id))
    cadre = result.scalar_one_or_none()
    if not cadre:
        raise HTTPException(status_code=404, detail="Cadre not found")
    return cadre


@router.post("/", response_model=CadreResponse, status_code=201)
async def create_cadre(cadre_data: CadreCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = cadre_data.model_dump()
    if data.get("id_card_encrypted"):
        data["id_card_encrypted"] = encrypt_field(data["id_card_encrypted"])
    cadre = Cadre(**data)
    db.add(cadre)
    await db.commit()
    await db.refresh(cadre)
    await write_audit_log(db, current_user.id, "create", "cadre", cadre.id, {"name": cadre.name})
    return cadre


@router.put("/{cadre_id}", response_model=CadreResponse)
async def update_cadre(cadre_id: UUID, cadre_data: CadreUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Cadre).where(Cadre.id == cadre_id))
    cadre = result.scalar_one_or_none()
    if not cadre:
        raise HTTPException(status_code=404, detail="Cadre not found")
    data = cadre_data.model_dump(exclude_unset=True)
    if data.get("id_card_encrypted"):
        data["id_card_encrypted"] = encrypt_field(data["id_card_encrypted"])
    for key, value in data.items():
        setattr(cadre, key, value)
    await db.commit()
    await db.refresh(cadre)
    await write_audit_log(db, current_user.id, "update", "cadre", cadre.id, {"name": cadre.name})
    return cadre


@router.delete("/{cadre_id}")
async def delete_cadre(cadre_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Cadre).where(Cadre.id == cadre_id))
    cadre = result.scalar_one_or_none()
    if not cadre:
        raise HTTPException(status_code=404, detail="Cadre not found")
    cadre.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "cadre", cadre.id, {"name": cadre.name})
    return {"message": "Cadre deleted"}


@router.get("/{cadre_id}/id-card/masked")
async def get_masked_id_card(cadre_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Cadre).where(Cadre.id == cadre_id))
    cadre = result.scalar_one_or_none()
    if not cadre or not cadre.id_card_encrypted:
        raise HTTPException(status_code=404, detail="Cadre or ID card not found")
    decrypted = decrypt_field(cadre.id_card_encrypted)
    return {"masked": mask_id_card(decrypted)}
