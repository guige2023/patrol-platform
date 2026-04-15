from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
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
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

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


STATUS_LABELS = {
    "draft": "草稿",
    "submitted": "已提交",
    "approved": "已批准",
    "published": "已发布",
    "in_progress": "进行中",
    "completed": "已完成",
}


@router.get("/download")
async def export_plans(
    year: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all plans as .xlsx."""
    query = select(Plan).where(Plan.is_active == True)
    if year:
        query = query.where(Plan.year == year)
    if status:
        query = query.where(Plan.status == status)
    query = query.order_by(Plan.year.desc(), Plan.created_at.desc()).limit(10000)
    result = await db.execute(query)
    plans = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "巡察计划"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1677FF")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    headers = [
        "计划名称", "轮次", "年份", "状态",
        "计划开始日期", "计划结束日期", "实际开始日期", "实际结束日期",
        "巡察范围", "重点领域", "版本", "审批意见",
        "授权日期", "创建时间",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for p in plans:
        focus_str = ",".join(p.focus_areas) if isinstance(p.focus_areas, list) else (p.focus_areas or "")
        auth_date = p.authorization_date.strftime('%Y-%m-%d') if p.authorization_date else ""
        created = p.created_at.strftime('%Y-%m-%d %H:%M') if p.created_at else ""
        ws.append([
            p.name or "",
            p.round_name or "",
            p.year or "",
            STATUS_LABELS.get(p.status, p.status or ""),
            p.planned_start_date.strftime('%Y-%m-%d') if p.planned_start_date else "",
            p.planned_end_date.strftime('%Y-%m-%d') if p.planned_end_date else "",
            p.actual_start_date.strftime('%Y-%m-%d') if p.actual_start_date else "",
            p.actual_end_date.strftime('%Y-%m-%d') if p.actual_end_date else "",
            p.scope or "",
            focus_str,
            p.version or 1,
            p.approval_comment or "",
            auth_date,
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
        headers={"Content-Disposition": "attachment; filename*=UTF-8''plans.xlsx"},
    )


@router.get("/template")
async def download_plan_template(
    current_user: User = Depends(get_current_user),
):
    """Download plan import template (.xlsx)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "巡察计划导入模板"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="52C41A")
    header_align = Alignment(horizontal="center", vertical="center")
    note_fill = PatternFill("solid", fgColor="FFF7E6")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    headers = ["计划名称*", "轮次(第X轮)", "年份*", "计划开始日期", "计划结束日期", "巡察范围", "状态"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    notes = [
        "必填", "如：第一轮", "必填，如：2024", "YYYY-MM-DD", "YYYY-MM-DD", "巡察范围描述", "draft/submitted/approved/published/in_progress/completed",
    ]
    ws.append(notes)
    for cell in ws[2]:
        cell.fill = note_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
        cell.font = Font(size=10, color="999999")

    sample = [
        ["2024年巡察计划", "第一轮", 2024, "2024-03-01", "2024-05-31", "对XX单位开展巡察", "draft"],
    ]
    for row in sample:
        ws.append(row)
        for cell in ws[ws.max_row]:
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")

    ws.row_dimensions[2].height = 36
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 6, 45)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''plan_template.xlsx"},
    )


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Plan).where(Plan.id == plan_id, Plan.is_active == True))
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


# p-flow-1: 通用状态切换（用于 published→in_progress, in_progress→completed）
class StatusUpdateRequest(BaseModel):
    status: str  # "in_progress" | "completed"


@router.post("/{plan_id}/status")
async def update_plan_status(
    plan_id: UUID,
    data: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """切换计划状态：published → in_progress，或 in_progress → completed"""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    valid_transitions = {
        PlanStatus.PUBLISHED.value: PlanStatus.IN_PROGRESS.value,
        PlanStatus.IN_PROGRESS.value: PlanStatus.COMPLETED.value,
    }
    if data.status not in valid_transitions.values():
        raise HTTPException(status_code=400, detail="无效的目标状态")

    current_allowed = [k for k, v in valid_transitions.items() if v == data.status]
    if plan.status not in current_allowed:
        raise HTTPException(status_code=400, detail=f"当前状态({plan.status})不可切换至{data.status}")

    if data.status == PlanStatus.IN_PROGRESS.value and plan.status == PlanStatus.PUBLISHED.value:
        plan.status = PlanStatus.IN_PROGRESS.value
        from datetime import datetime
        plan.actual_start_date = datetime.now()
    elif data.status == PlanStatus.COMPLETED.value and plan.status == PlanStatus.IN_PROGRESS.value:
        plan.status = PlanStatus.COMPLETED.value
        from datetime import datetime
        plan.actual_end_date = datetime.now()
    else:
        raise HTTPException(status_code=400, detail="状态流转不符合规则")

    await db.commit()
    await write_audit_log(db, current_user.id, "status_change", "plan", plan_id, {"new_status": data.status})
    return {"message": f"状态已更新为 {data.status}"}
