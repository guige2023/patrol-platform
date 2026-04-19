import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from uuid import UUID
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.system_config import SystemConfig

router = APIRouter()


def parse_value(value: str) -> Any:
    """Try to parse value as JSON, otherwise return as string."""
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value


@router.get("/", response_model=List[Dict[str, Any]])
async def list_system_configs(
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """列出所有系统配置（key-value形式返回）"""
    result = await uow.execute(select(SystemConfig).order_by(SystemConfig.key))
    configs = result.scalars().all()
    return [
        {
            "key": c.key,
            "value": parse_value(c.value),
            "description": c.description,
        }
        for c in configs
    ]


@router.get("/{key}", response_model=Dict[str, Any])
async def get_system_config(
    key: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """获取单个系统配置"""
    result = await uow.execute(select(SystemConfig).where(SystemConfig.key == key))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"配置项 '{key}' 不存在")
    return {
        "key": config.key,
        "value": parse_value(config.value),
        "description": config.description,
    }


@router.put("/{key}", response_model=Dict[str, Any])
async def update_system_config(
    key: str,
    payload: Dict[str, Any],
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """更新单个系统配置"""
    value = payload.get("value")
    if value is None:
        raise HTTPException(status_code=400, detail="缺少 value 字段")

    result = await uow.execute(select(SystemConfig).where(SystemConfig.key == key))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"配置项 '{key}' 不存在")

    # Serialize value to JSON string if it's a list/dict, otherwise string
    if isinstance(value, (list, dict)):
        config.value = json.dumps(value, ensure_ascii=False)
    else:
        config.value = str(value)

    await uow.commit()
    await uow.refresh(config)
    return {
        "key": config.key,
        "value": parse_value(config.value),
        "description": config.description,
    }
