from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
import io, csv, codecs
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


@router.get("/export")
async def export_cadres(
    name: Optional[str] = None,
    unit_id: Optional[UUID] = None,
    is_available: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export cadres as CSV (max 10000 rows)."""
    query = select(Cadre).where(Cadre.is_active == True)
    if name:
        query = query.where(Cadre.name.ilike(f"%{name}%"))
    if unit_id:
        query = query.where(Cadre.unit_id == unit_id)
    if is_available is not None:
        query = query.where(Cadre.is_available == is_available)
    query = query.order_by(Cadre.created_at.desc()).limit(10000)
    result = await db.execute(query)
    cadres = result.scalars().all()

    # Build CSV string directly
    lines = []
    lines.append("姓名,性别,出生日期,民族,籍贯,政治面貌,学历,学位,职务,职级,类别,所属单位,标签,是否可用,创建时间")
    for c in cadres:
        created = c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else ""
        lines.append(
            f"{(c.name or '')},{(c.gender or '')},{str(c.birth_date) if c.birth_date else ''},"
            f"{(c.ethnicity or '')},{(c.native_place or '')},{(c.political_status or '')},"
            f"{(c.education or '')},{(c.degree or '')},{(c.position or '')},{(c.rank or '')},"
            f"{(c.category or '')},,{(c.tags or '')},"
            f"{'是' if c.is_available else '否'},{created}"
        )
    csv_content = "\n".join(lines).encode("utf-8-sig")
    output = io.BytesIO(csv_content)

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8-sig",
        headers={
            "Content-Disposition": "attachment; filename=cadres_export.csv",
        },
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


@router.post("/import")
async def import_cadres(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    导入干部数据（Excel .xlsx）
    必填列：name
    可选列：gender, birth_date, ethnicity, native_place, political_status,
            education, degree, unit_id, position, rank, category, tags, profile,
            resume, achievements(JSON), is_available
    """
    import openpyxl

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx 文件")

    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    headers = [str(h.value).strip() if h.value else "" for h in ws[1]]
    col_map = {h.lower(): i for i, h in enumerate(headers)}

    if "name" not in col_map:
        raise HTTPException(status_code=400, detail="缺少必填列: name")

    created, skipped, errors = 0, 0, []
    first_id = None
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        try:
            name = row[col_map["name"]]
            if not name:
                errors.append(f"第{row_idx}行: name 为空")
                continue

            # 按姓名查重
            exist = await db.execute(select(Cadre).where(Cadre.name == str(name).strip()))
            if exist.scalar_one_or_none():
                skipped += 1
                continue

            data = {
                "name": str(name).strip(),
                "gender": _cell(row, col_map, "gender"),
                "birth_date": _date_cell(row, col_map, "birth_date"),
                "ethnicity": _cell(row, col_map, "ethnicity"),
                "native_place": _cell(row, col_map, "native_place"),
                "political_status": _cell(row, col_map, "political_status"),
                "education": _cell(row, col_map, "education"),
                "degree": _cell(row, col_map, "degree"),
                "unit_id": None,
                "position": _cell(row, col_map, "position"),
                "rank": _cell(row, col_map, "rank"),
                "category": _cell(row, col_map, "category"),
                "tags": _list_cell(row, col_map, "tags"),
                "profile": _cell(row, col_map, "profile"),
                "resume": _cell(row, col_map, "resume"),
                "achievements": _json_cell(row, col_map, "achievements"),
                "is_available": _bool_cell(row, col_map, "is_available", default=True),
            }
            cadre = Cadre(**{k: v for k, v in data.items() if v is not None})
            db.add(cadre)
            await db.flush()
            if first_id is None:
                first_id = cadre.id
            created += 1
        except Exception as e:
            errors.append(f"第{row_idx}行: {str(e)}")

    await db.commit()
    if errors and created == 0:
        raise HTTPException(status_code=400, detail=f"导入失败: {'; '.join(errors[:5])}")

    if first_id is not None:
        await write_audit_log(db, current_user.id, "import", "cadre", first_id, {
            "created": created, "skipped": skipped
        })
    return {
        "message": f"导入完成：新增 {created} 条，{skipped} 条因姓名重复被跳过",
        "detail": f"{skipped}条记录因姓名重复被跳过，可前往列表手动编辑覆盖",
        "created": created,
        "skipped": skipped,
        "errors": errors[:10],
    } if created > 0 else {
        "message": f"无新数据导入（{skipped}条姓名重复）",
        "detail": f"{skipped}条记录因姓名重复被跳过，可前往列表手动编辑覆盖",
        "created": 0,
        "skipped": skipped,
        "errors": errors[:10],
    }


def _cell(row, col_map, key):
    if key not in col_map:
        return None
    v = row[col_map[key]]
    return str(v).strip() if v is not None else None


def _date_cell(row, col_map, key):
    from datetime import date
    v = _cell(row, col_map, key)
    if not v:
        return None
    try:
        return date.fromisoformat(str(v).strip())
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

