from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
import io, csv, codecs

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


@router.get("/export")
async def export_units(
    name: Optional[str] = None,
    unit_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export units as CSV."""
    query = select(Unit).where(Unit.is_active == True)
    if name:
        query = query.where(Unit.name.ilike(f"%{name}%"))
    if unit_type:
        query = query.where(Unit.unit_type == unit_type)
    query = query.order_by(Unit.sort_order or 0, Unit.created_at.desc()).limit(10000)
    result = await db.execute(query)
    units = result.scalars().all()

    output = io.BytesIO()
    output.write(codecs.BOM_UTF8)
    # Write header
    header = "单位名称,组织编码,单位类型,单位级别,上级单位,排序,标签,简介,最近巡察年份,巡察历史,是否可用\n"
    output.write(header.encode("utf-8-sig"))
    for u in units:
        tags_str = ",".join(u.tags) if u.tags else ""
        row = (
            f"{(u.name or '')},{(u.org_code or '')},{(u.unit_type or '')},{(u.level or '')},"
            f",{(u.sort_order or '')},{tags_str},{(u.profile or '')},"
            f"{(u.last_inspection_year or '')},{(u.inspection_history or '')},"
            f"{'是' if u.is_active else '否'}\n"
        )
        output.write(row.encode("utf-8-sig"))

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=units_export.csv"},
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



@router.post("/import")
async def import_units(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    导入单位数据（Excel .xlsx）
    必填列：name, org_code
    可选列：parent_id, unit_type, level, sort_order, tags, profile, leadership( JSON),
            contact( JSON), is_active
    """
    import openpyxl
    from app.schemas.unit import UnitCreate

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx 文件")

    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    headers = [str(h.value).strip() if h.value else "" for h in ws[1]]
    col_map = {h.lower(): i for i, h in enumerate(headers)}

    required = ["name", "org_code"]
    for col in required:
        if col not in col_map:
            raise HTTPException(status_code=400, detail=f"缺少必填列: {col}")

    created, skipped, errors = 0, 0, []
    first_id = None
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        try:
            name = row[col_map["name"]]
            org_code = row[col_map["org_code"]]
            if not name or not org_code:
                errors.append(f"第{row_idx}行: name 或 org_code 为空")
                continue

            # 检查是否已存在
            exist = await db.execute(
                select(Unit).where(Unit.org_code == str(org_code))
            )
            if exist.scalar_one_or_none():
                skipped += 1
                continue

            data = {
                "name": str(name).strip(),
                "org_code": str(org_code).strip(),
                "unit_type": _cell(row, col_map, "unit_type"),
                "level": _cell(row, col_map, "level"),
                "sort_order": _int_cell(row, col_map, "sort_order") or 0,
                "tags": _list_cell(row, col_map, "tags"),
                "profile": _cell(row, col_map, "profile"),
                "leadership": _json_cell(row, col_map, "leadership"),
                "contact": _json_cell(row, col_map, "contact"),
                "is_active": _bool_cell(row, col_map, "is_active", default=True),
                "parent_id": None,
                "last_inspection_year": _int_cell(row, col_map, "last_inspection_year"),
                "inspection_history": _cell(row, col_map, "inspection_history"),
            }
            unit = Unit(**data)
            db.add(unit)
            await db.flush()
            if first_id is None:
                first_id = unit.id
            created += 1
        except Exception as e:
            errors.append(f"第{row_idx}行: {str(e)}")

    await db.commit()
    if errors and created == 0:
        raise HTTPException(status_code=400, detail=f"导入失败: {'; '.join(errors[:5])}")

    if first_id is not None:
        await write_audit_log(db, current_user.id, "import", "unit", first_id, {
            "created": created, "skipped": skipped
        })
    return {
        "message": f"导入完成：新增 {created} 条，{skipped} 条因组织编码重复被跳过",
        "detail": f"{skipped}条记录因组织编码重复被跳过，可前往列表手动编辑覆盖",
        "created": created,
        "skipped": skipped,
        "errors": errors[:10],
    } if created > 0 else {
        "message": f"无新数据导入（{skipped}条组织编码重复）",
        "detail": f"{skipped}条记录因组织编码重复被跳过，可前往列表手动编辑覆盖",
        "created": 0,
        "skipped": skipped,
        "errors": errors[:10],
    }


def _cell(row, col_map, key):
    if key not in col_map:
        return None
    v = row[col_map[key]]
    return str(v).strip() if v is not None else None


def _int_cell(row, col_map, key):
    v = _cell(row, col_map, key)
    try:
        return int(v) if v else None
    except (ValueError, TypeError):
        return None


def _bool_cell(row, col_map, key, default=False):
    v = _cell(row, col_map, key)
    if v is None:
        return default
    return str(v).lower() in ("true", "1", "是", "yes")


def _list_cell(row, col_map, key):
    v = _cell(row, col_map, key)
    if not v:
        return []
    return [s.strip() for s in str(v).split(",") if s.strip()]


def _json_cell(row, col_map, key):
    import json
    v = _cell(row, col_map, key)
    if not v:
        return None
    try:
        return json.loads(v)
    except (json.JSONDecodeError, TypeError):
        return {"raw": v}
