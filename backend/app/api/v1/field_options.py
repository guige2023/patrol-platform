from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import json

from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.field_option import FieldOption
from app.schemas.field_option import FieldOptionCreate, FieldOptionUpdate, FieldOptionResponse

router = APIRouter()


@router.get("/", response_model=List[FieldOptionResponse])
async def list_field_options(
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(FieldOption).order_by(FieldOption.sort_order, FieldOption.field_key))
    options = result.scalars().all()
    return [FieldOptionResponse.from_model(o) for o in options]


@router.get("/{field_key}", response_model=FieldOptionResponse)
async def get_field_option(
    field_key: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(FieldOption).where(FieldOption.field_key == field_key))
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=404, detail=f"字段 '{field_key}' 不存在")
    return FieldOptionResponse.from_model(option)


@router.post("/", response_model=FieldOptionResponse, status_code=201)
async def create_field_option(
    data: FieldOptionCreate,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    existing = await uow.execute(select(FieldOption).where(FieldOption.field_key == data.field_key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"字段 '{data.field_key}' 已存在")

    option = FieldOption(
        field_key=data.field_key,
        label=data.label,
        options=json.dumps([o.model_dump() for o in data.options], ensure_ascii=False),
        sort_order=0,
    )
    uow.add(option)
    await uow.commit()
    await uow.refresh(option)
    return FieldOptionResponse.from_model(option)


@router.put("/{field_key}", response_model=FieldOptionResponse)
async def update_field_option(
    field_key: str,
    data: FieldOptionUpdate,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(FieldOption).where(FieldOption.field_key == field_key))
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=404, detail=f"字段 '{field_key}' 不存在")

    if data.label is not None:
        option.label = data.label
    if data.options is not None:
        option.options = json.dumps([o.model_dump() for o in data.options], ensure_ascii=False)
    if data.sort_order is not None:
        option.sort_order = data.sort_order

    await uow.commit()
    await uow.refresh(option)
    return FieldOptionResponse.from_model(option)


@router.delete("/{field_key}")
async def delete_field_option(
    field_key: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(FieldOption).where(FieldOption.field_key == field_key))
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=404, detail=f"字段 '{field_key}' 不存在")

    await uow.delete(option)
    await uow.commit()
    return {"message": f"字段 '{field_key}' 已删除"}
