from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List
from uuid import UUID
import json

from app.dependencies import get_uow, get_current_user, require_permission
from app.database import UnitOfWork
from app.models.user import User
from app.models.field_option import FieldOption
from app.schemas.field_option import (
    FieldOptionCreate, FieldOptionUpdate, FieldOptionResponse,
    FieldOptionSummary, SyncResult,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# 业务表 → entity_type 映射（供 sync 使用）
# ---------------------------------------------------------------------------
BUSINESS_TABLES = {
    "units":             "units",
    "cadres":            "cadres",
    "users":             "users",
    "inspection_plans":  "plans",
    "inspection_groups":  "groups",
    "clues":            "clues",
    "rectifications":    "rectifications",
    "drafts":           "drafts",
    "documents":        "documents",
    "knowledge":        "knowledge",
}


@router.get("/", response_model=List[FieldOptionResponse])
async def list_field_options(
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """返回所有字段配置（含完整options）"""
    result = await uow.execute(
        select(FieldOption).order_by(FieldOption.entity_type, FieldOption.sort_order, FieldOption.field_key)
    )
    options = result.scalars().all()
    return [FieldOptionResponse.from_model(o) for o in options]


@router.get("/by-entity/{entity_type}", response_model=List[FieldOptionSummary])
async def list_fields_by_entity(
    entity_type: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """按 entity_type 返回字段配置列表（不含options，列表用）"""
    result = await uow.execute(
        select(FieldOption)
        .where(FieldOption.entity_type == entity_type)
        .order_by(FieldOption.sort_order, FieldOption.field_key)
    )
    fields = result.scalars().all()
    return [FieldOptionSummary.model_validate(f) for f in fields]


@router.get("/entity-types", response_model=List[str])
async def list_entity_types(
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """返回所有有配置的 entity_type 列表"""
    result = await uow.execute(
        select(FieldOption.entity_type)
        .distinct()
        .order_by(FieldOption.entity_type)
    )
    return [row[0] for row in result.all()]


@router.get("/discover/{entity_type}", response_model=List[dict])
async def discover_db_fields(
    entity_type: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """
    从数据库 schema 自动发现 entity_type 对应表的所有可配置字段。
    返回尚未录入 field_options 的字段列表，供前端确认后批量导入。
    """
    table_map = {
        "units":            "units",
        "cadres":           "cadres",
        "users":            "users",
        "plans":            "inspection_plans",
        "groups":           "inspection_groups",
        "clues":            "clues",
        "rectifications":   "rectifications",
        "drafts":           "drafts",
        "documents":        "documents",
        "knowledge":        "knowledge",
    }
    table_name = table_map.get(entity_type)
    if not table_name:
        raise HTTPException(status_code=400, detail=f"不支持的 entity_type: {entity_type}")

    # 查询该表的所有非 datetime/date/numeric/boolean/json/uuid 列
    # PostgreSQL 的 data_type 是小写：uuid, jsonb, text, integer 等
    query = text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :tbl
          AND data_type NOT IN (
              'timestamp without time zone', 'timestamp with time zone',
              'date', 'time without time zone', 'time with time zone',
              'integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision',
              'boolean', 'bytea', 'uuid', 'json', 'jsonb'
          )
          AND column_name NOT IN ('id', 'created_at', 'updated_at', 'deleted_at',
                                  'is_active', 'is_deleted', 'sort_order',
                                  'created_by', 'updated_by', 'deleted_by',
                                  'parent_id', 'unit_id', 'file_path', 'file_size', 'mime_type',
                                  'user_id', 'group_id', 'plan_id', 'attachment_id',
                                  'knowledge_id', 'document_id', 'clue_id', 'rectification_id',
                                  'draft_id', 'alert_id', 'notification_id', 'warning_id',
                                  'progress_id', 'rule_id', 'module_id', 'system_config_id',
                                  'is_read', 'resolved_by', 'resolved_at')
        ORDER BY ordinal_position
    """)
    db_result = await uow.execute(query, {"tbl": table_name})
    db_cols = {row[0]: row[1] for row in db_result.all()}

    # 已有配置的字段 key
    existing = await uow.execute(
        select(FieldOption.column_name)
        .where(FieldOption.entity_type == entity_type)
    )
    configured = {row[0] for row in existing.all()}

    # 过滤出未配置的
    new_cols = [
        {"column_name": col, "data_type": dtype, "field_key": f"{entity_type}.{col}"}
        for col, dtype in db_cols.items()
        if col not in configured and col not in ("id", "created_at", "updated_at")
    ]
    return new_cols


@router.post("/sync/{entity_type}", response_model=SyncResult)
async def sync_fields(
    entity_type: str,
    fields: List[dict],
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(require_permission("field:write")),
):
    """
    将 discover 发现的字段批量注册到 field_options。
    fields: [{"column_name": "...", "data_type": "...", "field_key": "...", "label": "..."}]
    """
    added = 0
    skipped = 0
    new_keys = []

    for f in fields:
        col = f.get("column_name")
        dt = f.get("data_type", "text")
        fk = f.get("field_key")
        label = f.get("label") or col

        # 避免重复
        existing = await uow.execute(
            select(FieldOption).where(FieldOption.field_key == fk)
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        opt = FieldOption(
            field_key=fk,
            entity_type=entity_type,
            column_name=col,
            data_type="select" if dt == "USER-DEFINED" else "text",
            label=label,
            options="[]",
            is_editable=True,
            is_required=False,
            is_visible=True,
            is_picklist=False,
        )
        uow.add(opt)
        added += 1
        new_keys.append(fk)

    await uow.commit()

    # 读取已存在的总数（用于日志）
    total_result = await uow.execute(select(FieldOption).where(FieldOption.entity_type == entity_type))
    total = len(total_result.scalars().all())

    return SyncResult(added=added, updated=0, skipped=skipped, new_fields=new_keys)


@router.get("/detail/{field_key}", response_model=FieldOptionResponse)
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
    current_user: User = Depends(require_permission("field:write")),
):
    existing = await uow.execute(select(FieldOption).where(FieldOption.field_key == data.field_key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"字段 '{data.field_key}' 已存在")

    option = FieldOption(
        field_key=data.field_key,
        entity_type=data.entity_type,
        column_name=data.column_name,
        data_type=data.data_type,
        label=data.label,
        options=json.dumps([o.model_dump() for o in data.options], ensure_ascii=False),
        is_editable=data.is_editable,
        is_required=data.is_required,
        is_visible=data.is_visible,
        is_picklist=data.is_picklist,
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
    current_user: User = Depends(require_permission("field:write")),
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
    if data.is_editable is not None:
        option.is_editable = data.is_editable
    if data.is_required is not None:
        option.is_required = data.is_required
    if data.is_visible is not None:
        option.is_visible = data.is_visible
    if data.is_picklist is not None:
        option.is_picklist = data.is_picklist

    await uow.commit()
    await uow.refresh(option)
    return FieldOptionResponse.from_model(option)


@router.delete("/{field_key}")
async def delete_field_option(
    field_key: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(require_permission("field:write")),
):
    result = await uow.execute(select(FieldOption).where(FieldOption.field_key == field_key))
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=404, detail=f"字段 '{field_key}' 不存在")

    await uow.delete(option)
    await uow.commit()
    return {"message": f"字段 '{field_key}' 已删除"}
