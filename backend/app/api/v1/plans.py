from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.dependencies import get_db, get_current_user
from app.models.plan import Plan, PlanVersion, PlanStatus
from app.models.user import User
from app.models.inspection_group import InspectionGroup, GroupMember
from app.models.draft import Draft
from app.models.rectification import Rectification
from app.models.cadre import Cadre
from app.models.unit import Unit
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
    ids: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export plans as .xlsx. If ids is provided (comma-separated UUIDs), export only those."""
    query = select(Plan).where(Plan.is_active == True)
    if year:
        query = query.where(Plan.year == year)
    if status:
        query = query.where(Plan.status == status)
    if ids:
        id_list = [i.strip() for i in ids.split(",") if i.strip()]
        if id_list:
            query = query.where(Plan.id.in_(id_list))
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


RECTIFICATION_STATUS_LABELS = {
    "dispatched": "已派发",
    "signed": "已签收",
    "progressing": "进行中",
    "completed": "已完成",
    "submitted": "待验收",
    "verified": "已验收",
    "rejected": "已驳回",
}

DRAFT_STATUS_LABELS = {
    "draft": "草稿",
    "preliminary_review": "初审中",
    "final_review": "终审中",
    "approved": "已通过",
    "rejected": "已驳回",
}

DRAFT_SEVERITY_LABELS = {
    "mild": "轻微",
    "moderate": "中等",
    "severe": "严重",
}


def _make_header(ws, headers):
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1677FF")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )
    ws.append(headers)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border


def _auto_width(ws):
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 4, 45)


@router.get("/{plan_id}/report")
async def export_plan_report(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export complete inspection plan report as multi-sheet Excel.

    Sheets: 巡察计划 | 巡察组 | 整改项 | 底稿
    """
    # 1. Plan
    result = await db.execute(select(Plan).where(Plan.id == plan_id, Plan.is_active == True))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # 2. Groups for this plan
    groups_result = await db.execute(
        select(InspectionGroup)
        .options(selectinload(InspectionGroup.members).selectinload(GroupMember.cadre))
        .where(InspectionGroup.plan_id == plan_id, InspectionGroup.is_active == True)
    )
    groups = groups_result.scalars().all()
    group_ids = [g.id for g in groups]
    target_unit_ids = list({g.target_unit_id for g in groups if g.target_unit_id})

    # 3. Drafts for these groups
    drafts = []
    if group_ids:
        drafts_result = await db.execute(
            select(Draft).where(Draft.group_id.in_(group_ids), Draft.is_active == True)
        )
        drafts = drafts_result.scalars().all()

    # 4. Rectifications for target units
    rectifications = []
    if target_unit_ids:
        rect_result = await db.execute(
            select(Rectification).where(
                Rectification.unit_id.in_(target_unit_ids),
                Rectification.is_active == True
            )
        )
        rectifications = rect_result.scalars().all()

    # 5. Build workbook
    wb = openpyxl.Workbook()

    # ── Sheet 1: 巡察计划 ──
    ws1 = wb.active
    ws1.title = "巡察计划"
    _make_header(ws1, [
        "计划名称", "年份", "轮次", "巡察范围", "重点领域",
        "授权文书", "授权日期",
        "计划开始日期", "计划结束日期",
        "实际开始日期", "实际结束日期",
        "状态", "审批意见", "版本",
    ])
    focus_str = ",".join(plan.focus_areas) if isinstance(plan.focus_areas, list) else (plan.focus_areas or "")
    ws1.append([
        plan.name or "",
        plan.year or "",
        plan.round_name or "",
        plan.scope or "",
        focus_str,
        plan.authorization_letter or "",
        plan.authorization_date.strftime('%Y-%m-%d') if plan.authorization_date else "",
        plan.planned_start_date.strftime('%Y-%m-%d') if plan.planned_start_date else "",
        plan.planned_end_date.strftime('%Y-%m-%d') if plan.planned_end_date else "",
        plan.actual_start_date.strftime('%Y-%m-%d') if plan.actual_start_date else "",
        plan.actual_end_date.strftime('%Y-%m-%d') if plan.actual_end_date else "",
        STATUS_LABELS.get(plan.status, plan.status or ""),
        plan.approval_comment or "",
        plan.version or 1,
    ])
    _auto_width(ws1)

    # ── Sheet 2: 巡察组 ──
    ws2 = wb.create_sheet("巡察组")
    _make_header(ws2, [
        "巡察组名称", "状态", "目标单位", "组长", "副组长", "联络员",
        "组员", "授权文书", "授权日期",
    ])
    for g in groups:
        member_by_role = {"组长": [], "副组长": [], "联络员": [], "组员": []}
        for m in g.members:
            if m.cadre:
                name = m.cadre.name or "未知"
            else:
                name = "未知"
            role = m.role or "组员"
            if role in member_by_role:
                member_by_role[role].append(name)
            else:
                member_by_role["组员"].append(name)
        target_unit_name = ""
        if g.target_unit_id:
            u_result = await db.execute(select(Unit).where(Unit.id == g.target_unit_id))
            u = u_result.scalar_one_or_none()
            if u:
                target_unit_name = u.name
        ws2.append([
            g.name or "",
            STATUS_LABELS.get(g.status, g.status or ""),
            target_unit_name,
            "、".join(member_by_role["组长"]),
            "、".join(member_by_role["副组长"]),
            "、".join(member_by_role["联络员"]),
            "、".join(member_by_role["组员"]),
            g.authorization_letter or "",
            g.authorization_date.strftime('%Y-%m-%d') if g.authorization_date else "",
        ])
    _auto_width(ws2)

    # ── Sheet 3: 整改项 ──
    ws3 = wb.create_sheet("整改项")
    _make_header(ws3, [
        "整改标题", "问题描述", "整改要求", "责任单位",
        "状态", "进度%", "派发日期", "签收日期", "完成日期", "整改要求",
    ])
    for r in rectifications:
        unit_name = ""
        if r.unit_id:
            u_result = await db.execute(select(Unit).where(Unit.id == r.unit_id))
            u = u_result.scalar_one_or_none()
            if u:
                unit_name = u.name
        ws3.append([
            r.title or "",
            r.problem_description or "",
            r.rectification_requirement or "",
            unit_name,
            RECTIFICATION_STATUS_LABELS.get(r.status, r.status or ""),
            r.progress or 0,
            r.created_at.strftime('%Y-%m-%d') if r.created_at else "",
            r.sign_date.strftime('%Y-%m-%d') if r.sign_date else "",
            r.completed_at.strftime('%Y-%m-%d') if r.completed_at else "",
            r.rectification_requirement or "",
        ])
    _auto_width(ws3)

    # ── Sheet 4: 底稿 ──
    ws4 = wb.create_sheet("底稿")
    _make_header(ws4, [
        "底稿标题", "问题类型", "严重程度", "分类",
        "状态", "证据摘要", "初审意见", "终审意见",
    ])
    for d in drafts:
        ws4.append([
            d.title or "",
            d.problem_type or "",
            DRAFT_SEVERITY_LABELS.get(d.severity, d.severity or ""),
            d.category or "",
            DRAFT_STATUS_LABELS.get(d.status, d.status or ""),
            d.evidence_summary or "",
            d.preliminary_review_comment or "",
            d.review_comment or "",
        ])
    _auto_width(ws4)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    plan_name_safe = (plan.name or "巡察报告").replace("/", "_").replace("\\", "_")
    filename = f"{plan_name_safe}_完整报告.xlsx"
    from urllib.parse import quote
    encoded_filename = quote(filename)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
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
