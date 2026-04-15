from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from app.dependencies import get_db, get_current_user
from app.models.rectification import Rectification
from app.models.user import User
from app.models.unit import Unit
from app.schemas.rectification import RectificationCreate, RectificationUpdate, RectificationResponse
from app.schemas.common import PaginatedResponse, PageResult
from app.core.audit import write_audit_log

router = APIRouter()

STATUS_LABELS = {
    "dispatched": "已派发",
    "signed": "已签收",
    "progressing": "整改中",
    "completed": "已完成",
    "verified": "已验收",
    "rejected": "已驳回",
}

ALERT_LABELS = {
    "green": "绿色",
    "yellow": "黄色",
    "red": "红色",
}


@router.get("/download")
async def export_rectifications(
    status: Optional[str] = None,
    alert_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all rectifications as .xlsx."""
    query = (
        select(Rectification)
        .options(selectinload(Rectification.unit))
        .where(Rectification.is_active == True)
    )
    if status:
        query = query.where(Rectification.status == status)
    if alert_level:
        query = query.where(Rectification.alert_level == alert_level)
    query = query.order_by(Rectification.created_at.desc()).limit(10000)
    result = await db.execute(query)
    rects = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "整改记录"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1677FF")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    headers = [
        "标题", "所属单位", "问题描述", "整改要求",
        "截止日期", "状态", "进度(%)", "预警级别",
        "签收日期", "完成日期", "整改报告", "验收意见",
        "创建时间",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for r in rects:
        deadline = r.deadline.strftime('%Y-%m-%d') if r.deadline else ""
        sign_date = r.sign_date.strftime('%Y-%m-%d') if r.sign_date else ""
        completion_date = r.completion_date.strftime('%Y-%m-%d') if r.completion_date else ""
        created = r.created_at.strftime('%Y-%m-%d %H:%M') if r.created_at else ""
        ws.append([
            r.title or "",
            r.unit.name if r.unit else "",
            r.problem_description or "",
            r.rectification_requirement or "",
            deadline,
            STATUS_LABELS.get(r.status, r.status or ""),
            r.progress or 0,
            ALERT_LABELS.get(r.alert_level, r.alert_level or ""),
            sign_date,
            completion_date,
            r.completion_report or "",
            r.verification_comment or "",
            created,
        ])

    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 4, 40)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''rectifications.xlsx"},
    )


@router.get("/", response_model=PaginatedResponse[RectificationResponse])
async def list_rectifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=9999),
    title: Optional[str] = None,
    status: Optional[str] = None,
    unit_id: Optional[UUID] = None,
    alert_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Rectification).where(Rectification.is_active == True)
    if title:
        query = query.where(Rectification.title.ilike(f"%{title}%"))
    if status:
        query = query.where(Rectification.status == status)
    if unit_id:
        query = query.where(Rectification.unit_id == unit_id)
    if alert_level:
        query = query.where(Rectification.alert_level == alert_level)
    
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    
    query = query.order_by(Rectification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return PaginatedResponse(
        data=PageResult(items=items, total=total, page=page, page_size=page_size)
    )


@router.get("/{rect_id}", response_model=RectificationResponse)
async def get_rectification(rect_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    return rect


@router.post("/", response_model=RectificationResponse, status_code=201)
async def create_rectification(rect_data: RectificationCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    rect = Rectification(**rect_data.model_dump(), created_by=current_user.id)
    db.add(rect)
    await db.commit()
    await db.refresh(rect)
    await write_audit_log(db, current_user.id, "create", "rectification", rect.id, {"title": rect.title})
    return rect


@router.put("/{rect_id}", response_model=RectificationResponse)
async def update_rectification(rect_id: UUID, rect_data: RectificationUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    for key, value in rect_data.model_dump(exclude_unset=True).items():
        setattr(rect, key, value)
    await db.commit()
    await db.refresh(rect)
    await write_audit_log(db, current_user.id, "update", "rectification", rect_id, {})
    return rect


@router.patch("/{rect_id}/progress")
async def update_progress(rect_id: UUID, progress: int, details: Optional[List[dict]] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.progress = max(0, min(100, progress))
    if details:
        rect.progress_details = details
    if rect.progress >= 100:
        rect.status = "completed"
        rect.completion_date = func.now()
    await db.commit()
    await write_audit_log(db, current_user.id, "update_progress", "rectification", rect_id, {"progress": progress})
    return {"message": "Progress updated"}


@router.post("/{rect_id}/sign")
async def sign_rectification(rect_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.status = "progressing"
    rect.sign_date = func.now()
    rect.sign_by = current_user.id
    await db.commit()
    await write_audit_log(db, current_user.id, "sign", "rectification", rect_id, {})
    return {"message": "Rectification signed"}


@router.post("/{rect_id}/verify")
async def verify_rectification(rect_id: UUID, comment: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.status = "verified"
    rect.verified_by = current_user.id
    rect.verified_at = func.now()
    rect.verification_comment = comment
    await db.commit()
    await write_audit_log(db, current_user.id, "verify", "rectification", rect_id, {})
    return {"message": "Rectification verified"}


@router.delete("/{rect_id}")
async def delete_rectification(rect_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Soft-delete a rectification by setting is_active=False."""
    result = await db.execute(select(Rectification).where(Rectification.id == rect_id))
    rect = result.scalar_one_or_none()
    if not rect:
        raise HTTPException(status_code=404, detail="Rectification not found")
    rect.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "rectification", rect_id, {})
    return {"message": "Rectification deleted"}
