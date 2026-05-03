from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, desc, case
from datetime import date, datetime, timedelta
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.unit import Unit
from app.models.plan import Plan
from app.models.draft import Draft
from app.models.rectification import Rectification
from app.models.clue import Clue
from app.models.inspection_group import InspectionGroup
from app.models.cadre import Cadre

router = APIRouter()


@router.get("/overview")
async def get_overview(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    unit_count = await uow.execute(select(func.count()).select_from(Unit).where(Unit.is_active == True))
    plan_count = await uow.execute(select(func.count()).select_from(Plan).where(Plan.is_active == True))
    draft_count = await uow.execute(select(func.count()).select_from(Draft).where(Draft.is_active == True))
    rect_count = await uow.execute(select(func.count()).select_from(Rectification).where(Rectification.is_active == True))
    clue_count = await uow.execute(select(func.count()).select_from(Clue))
    
    pending_rect = await uow.execute(
        select(func.count()).select_from(Rectification).where(
            Rectification.is_active == True,
            Rectification.status.in_(["dispatched", "signed", "progressing"])
        )
    )
    
    overdue_rect = await uow.execute(
        select(func.count()).select_from(Rectification).where(
            Rectification.is_active == True,
            Rectification.alert_level == "red"
        )
    )

    # Additional stats
    completed_rect = await uow.execute(
        select(func.count()).select_from(Rectification).where(
            Rectification.is_active == True,
            Rectification.status.in_(["completed", "verified"])
        )
    )

    in_progress_plan = await uow.execute(
        select(func.count()).select_from(Plan).where(
            Plan.is_active == True,
            Plan.status.in_(["in_progress", "published"])
        )
    )

    pending_plan = await uow.execute(
        select(func.count()).select_from(Plan).where(
            Plan.is_active == True,
            Plan.status.in_(["draft", "submitted", "approved"])
        )
    )
    
    return {
        "unit_count": unit_count.scalar(),
        "plan_count": plan_count.scalar(),
        "draft_count": draft_count.scalar(),
        "rectification_count": rect_count.scalar(),
        "clue_count": clue_count.scalar(),
        "pending_rectification": pending_rect.scalar(),
        "overdue_rectification": overdue_rect.scalar(),
        "completed_rectification": completed_rect.scalar(),
        "in_progress_plan_count": in_progress_plan.scalar(),
        "pending_plan_count": pending_plan.scalar(),
    }


@router.get("/stats")
async def get_stats(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    """Alias for overview - return same data structure."""
    return await get_overview(uow, current_user)


@router.get("/issues")
async def get_issue_profile(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    drafts_by_category = await uow.execute(
        select(Draft.category, func.count(Draft.id))
        .where(Draft.is_active == True, Draft.category != None)
        .group_by(Draft.category)
    )
    clues_by_source = await uow.execute(
        select(Clue.source, func.count(Clue.id))
        .group_by(Clue.source)
    )
    rect_by_level = await uow.execute(
        select(Rectification.alert_level, func.count(Rectification.id))
        .where(Rectification.is_active == True)
        .group_by(Rectification.alert_level)
    )

    # Rectifications by status
    rect_by_status_result = await uow.execute(
        select(Rectification.status, func.count(Rectification.id))
        .where(Rectification.is_active == True)
        .group_by(Rectification.status)
    )

    # Recent activities - combine recent plans, drafts, rectifications, clues
    recent_activities = []

    # Recent plans
    plans_result = await uow.execute(
        select(Plan)
        .where(Plan.is_active == True)
        .order_by(desc(Plan.created_at))
        .limit(5)
    )
    for p in plans_result.scalars().all():
        recent_activities.append({
            "id": str(p.id),
            "type": "plan",
            "title": f"计划「{p.name}」已创建",
            "time": p.created_at.isoformat() if p.created_at else "",
        })

    # Recent drafts
    drafts_result = await uow.execute(
        select(Draft)
        .where(Draft.is_active == True)
        .order_by(desc(Draft.created_at))
        .limit(5)
    )
    for d in drafts_result.scalars().all():
        recent_activities.append({
            "id": str(d.id),
            "type": "draft",
            "title": f"底稿「{d.title}」已提交",
            "time": d.created_at.isoformat() if d.created_at else "",
        })

    # Recent rectifications
    rects_result = await uow.execute(
        select(Rectification)
        .where(Rectification.is_active == True)
        .order_by(desc(Rectification.updated_at))
        .limit(5)
    )
    for r in rects_result.scalars().all():
        recent_activities.append({
            "id": str(r.id),
            "type": "rectification",
            "title": f"整改「{r.title}」已更新",
            "time": r.updated_at.isoformat() if r.updated_at else "",
        })

    # Recent clues
    clues_result = await uow.execute(
        select(Clue)
        .order_by(desc(Clue.created_at))
        .limit(5)
    )
    for c in clues_result.scalars().all():
        recent_activities.append({
            "id": str(c.id),
            "type": "clue",
            "title": f"线索「{c.title}」已登记",
            "time": c.created_at.isoformat() if c.created_at else "",
        })

    # Sort by time
    recent_activities.sort(key=lambda x: x.get("time", ""), reverse=True)
    recent_activities = recent_activities[:10]

    # Plan progress - all active plans with their status
    plan_progress = []
    plans_for_progress = await uow.execute(
        select(Plan)
        .where(Plan.is_active == True)
        .order_by(desc(Plan.created_at))
        .limit(10)
    )
    for p in plans_for_progress.scalars().all():
        progress_pct = 0
        if p.status == "completed":
            progress_pct = 100
        elif p.status == "in_progress" and p.actual_start_date:
            if p.planned_end_date:
                total_days = (p.planned_end_date - p.actual_start_date).days
                elapsed = (datetime.now() - p.actual_start_date).days
                progress_pct = min(100, max(0, int(elapsed / total_days * 100))) if total_days > 0 else 50
        
        status_label = {
            "draft": "草稿",
            "submitted": "待审批",
            "approved": "已审批",
            "published": "已发布",
            "in_progress": "进行中",
            "completed": "已完成",
        }.get(p.status, p.status)

        plan_progress.append({
            "name": p.name,
            "progress": progress_pct,
            "status": status_label,
        })

    # Current round progress - active plans with date info
    current_round_progress = []
    active_plans = await uow.execute(
        select(Plan)
        .where(Plan.is_active == True, Plan.status.in_(["published", "in_progress"]))
        .order_by(desc(Plan.created_at))
        .limit(5)
    )
    now = datetime.now()
    for p in active_plans.scalars().all():
        days_elapsed = 0
        days_total = 100
        percentage = 0

        if p.actual_start_date and p.planned_end_date:
            days_total = max(1, (p.planned_end_date - p.actual_start_date).days)
            days_elapsed = max(0, min(days_total, (now - p.actual_start_date).days))
            percentage = int(days_elapsed / days_total * 100)
        elif p.planned_start_date and p.planned_end_date:
            days_total = max(1, (p.planned_end_date - p.planned_start_date).days)
            days_elapsed = max(0, min(days_total, (now - p.planned_start_date).days))
            percentage = int(days_elapsed / days_total * 100)

        current_round_progress.append({
            "plan_id": str(p.id),
            "plan_name": p.name,
            "days_elapsed": days_elapsed,
            "days_total": days_total,
            "percentage": percentage,
        })

    # Uninspected units - units that haven't been inspected in the last 2 years
    current_year = date.today().year
    two_years_ago = current_year - 2

    # Get all plans and their inspected units via groups
    plan_units_result = await uow.execute(
        select(Plan).where(Plan.is_active == True, Plan.year >= two_years_ago)
    )
    inspected_unit_ids = set()
    for p in plan_units_result.scalars().all():
        # Each plan may have groups that inspect specific units
        groups_result = await uow.execute(
            select(InspectionGroup).where(InspectionGroup.plan_id == p.id, InspectionGroup.is_active == True)
        )
        for g in groups_result.scalars().all():
            # Use target_unit_id if available
            if g.target_unit_id:
                inspected_unit_ids.add(g.target_unit_id)
            # Also check unit_ids JSON field
            if g.unit_ids and isinstance(g.unit_ids, list):
                for uid in g.unit_ids:
                    if uid:
                        inspected_unit_ids.add(uid)

    # Get units not in the inspected list
    uninspected_result = await uow.execute(
        select(Unit)
        .where(Unit.is_active == True)
        .order_by(desc(Unit.created_at))
        .limit(20)
    )
    uninspected_units = []
    for u in uninspected_result.scalars().all():
        if u.id not in inspected_unit_ids:
            uninspected_units.append({
                "id": str(u.id),
                "name": u.name,
                "last_inspected_year": None,
            })
        if len(uninspected_units) >= 5:
            break

    # Yearly coverage
    yearly_coverage = []
    for year in range(current_year - 3, current_year + 1):
        year_plans = await uow.execute(
            select(Plan).where(Plan.is_active == True, Plan.year == year)
        )
        plan_list = year_plans.scalars().all()
        inspected_count = len(plan_list)

        total_units_result = await uow.execute(select(func.count()).select_from(Unit).where(Unit.is_active == True))
        total_units = total_units_result.scalar() or 1

        percentage = min(100, int(inspected_count / total_units * 100)) if total_units > 0 else 0

        yearly_coverage.append({
            "year": year,
            "inspected_count": inspected_count,
            "total_count": total_units,
            "percentage": percentage,
        })

    # Rectification deadlines (top 10 with nearest deadline)
    rect_deadlines_result = await uow.execute(
        select(Rectification)
        .where(
            Rectification.is_active == True,
            Rectification.deadline != None,
            Rectification.status.in_(["dispatched", "signed", "progressing", "submitted"])
        )
        .order_by(Rectification.deadline)
        .limit(10)
    )
    rectification_deadlines = []
    for r in rect_deadlines_result.scalars().all():
        unit_name = None
        if r.unit_id:
            unit_result = await uow.execute(select(Unit.name).where(Unit.id == r.unit_id))
            unit_name = unit_result.scalar()
        rectification_deadlines.append({
            "id": str(r.id),
            "title": r.title or "",
            "unit_name": unit_name,
            "deadline": r.deadline.isoformat() if r.deadline else None,
            "alert_level": r.alert_level or "green",
            "progress": r.progress or 0,
        })

    # Top problem types (from drafts)
    top_problems_result = await uow.execute(
        select(Draft.category, func.count(Draft.id))
        .where(Draft.is_active == True, Draft.category != None)
        .group_by(Draft.category)
        .order_by(desc(func.count(Draft.id)))
        .limit(10)
    )
    top_problem_types = [{"category": r[0], "count": r[1]} for r in top_problems_result.all()]

    # Unit rankings by rectification performance
    unit_rankings_result = await uow.execute(
        select(
            Unit.name,
            func.count(Rectification.id).label("rect_count"),
            func.sum(
                case((Rectification.status.in_(["completed", "verified"]), 1), else_=0)
            ).label("completed_count"),
            func.sum(
                case((Rectification.alert_level == "red", 1), else_=0)
            ).label("overdue_count"),
        )
        .join_from(Rectification, Unit, Rectification.unit_id == Unit.id)
        .where(Rectification.is_active == True)
        .group_by(Unit.id, Unit.name)
        .order_by(desc(func.count(Rectification.id)))
        .limit(10)
    )
    unit_rankings = [
        {
            "unit_name": r[0],
            "rectification_count": r[1] or 0,
            "completed_count": r[2] or 0,
            "overdue_count": r[3] or 0,
        }
        for r in unit_rankings_result.all()
    ]

    # Rectification trend (last 6 months)
    rectification_trend = []
    for i in range(5, -1, -1):
        month_date = datetime(now.year, now.month, 1)
        import calendar
        if i > 0:
            month_date = month_date.replace(day=1) - timedelta(days=1)
            month_date = month_date.replace(day=1)
        else:
            month_date = month_date.replace(day=1)
        _, last_day = calendar.monthrange(month_date.year, month_date.month)
        month_end = month_date.replace(day=last_day, hour=23, minute=59, second=59)

        completed_count = await uow.execute(
            select(func.count()).select_from(Rectification).where(
                Rectification.is_active == True,
                Rectification.status.in_(["completed", "verified"]),
                Rectification.updated_at >= month_date,
                Rectification.updated_at <= month_end,
            )
        )
        submitted_count = await uow.execute(
            select(func.count()).select_from(Rectification).where(
                Rectification.is_active == True,
                Rectification.status == "submitted",
                Rectification.updated_at >= month_date,
                Rectification.updated_at <= month_end,
            )
        )
        rejected_count = await uow.execute(
            select(func.count()).select_from(Rectification).where(
                Rectification.is_active == True,
                Rectification.status == "rejected",
                Rectification.updated_at >= month_date,
                Rectification.updated_at <= month_end,
            )
        )

        month_label = f"{month_date.year}年{month_date.month}月"
        rectification_trend.append({
            "month": month_label,
            "completed": completed_count.scalar() or 0,
            "submitted": submitted_count.scalar() or 0,
            "rejected": rejected_count.scalar() or 0,
        })

    return {
        "drafts_by_category": [{"category": r[0], "count": r[1]} for r in drafts_by_category.all()],
        "clues_by_source": [{"source": r[0], "count": r[1]} for r in clues_by_source.all()],
        "rectifications_by_alert_level": [{"level": r[0], "count": r[1]} for r in rect_by_level.all()],
        "rectifications_by_status": [{"status": r[0], "count": r[1]} for r in rect_by_status_result.all()],
        "recent_activities": recent_activities,
        "plan_progress": plan_progress,
        "uninspected_units": uninspected_units,
        "current_round_progress": current_round_progress,
        "yearly_coverage": yearly_coverage,
        "rectification_deadlines": rectification_deadlines,
        "top_problem_types": top_problem_types,
        "unit_rankings": unit_rankings,
        "rectification_trend": rectification_trend,
    }


@router.get("/yearly-stats")
async def get_yearly_stats(
    year: int = date.today().year,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Monthly counts of plans and inspection groups for a given year."""
    months = list(range(1, 13))
    plan_counts = [0] * 12
    group_counts = [0] * 12

    # Plans per month
    plan_result = await uow.execute(
        select(
            extract("month", Plan.created_at).label("month"),
            func.count(Plan.id).label("count"),
        )
        .where(extract("year", Plan.created_at) == year)
        .group_by(extract("month", Plan.created_at))
    )
    for row in plan_result.all():
        m = int(row.month)
        plan_counts[m - 1] = row.count

    # Groups per month
    group_result = await uow.execute(
        select(
            extract("month", InspectionGroup.created_at).label("month"),
            func.count(InspectionGroup.id).label("count"),
        )
        .where(extract("year", InspectionGroup.created_at) == year)
        .group_by(extract("month", InspectionGroup.created_at))
    )
    for row in group_result.all():
        m = int(row.month)
        group_counts[m - 1] = row.count

    return {
        "year": year,
        "months": months,
        "plan_counts": plan_counts,
        "group_counts": group_counts,
    }


@router.get("/yearly-coverage")
async def get_yearly_coverage(
    year: int = date.today().year,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Unit inspection coverage for a given year — which units have been inspected and how many times."""
    from app.models.plan import Plan
    from app.models.inspection_group import InspectionGroup

    # Total active units
    total_units_result = await uow.execute(
        select(func.count(Unit.id)).where(Unit.is_active == True)
    )
    total_units = total_units_result.scalar() or 0

    # Units that have been assigned to at least one inspection group in this year
    inspected_units_result = await uow.execute(
        select(Unit.id, Unit.name, func.count(InspectionGroup.id).label("inspection_count"))
        .join(InspectionGroup, InspectionGroup.target_unit_id == Unit.id)
        .where(extract("year", InspectionGroup.created_at) == year)
        .group_by(Unit.id, Unit.name)
    )
    inspected_units = [
        {"unit_id": str(row[0]), "unit_name": row[1], "inspection_count": row[2]}
        for row in inspected_units_result.all()
    ]
    inspected_unit_ids = {row[0] for row in inspected_units_result.all()}

    # Units not yet inspected this year
    all_units_result = await uow.execute(
        select(Unit.id, Unit.name).where(Unit.is_active == True)
    )
    not_inspected_units = [
        {"unit_id": str(row[0]), "unit_name": row[1], "inspection_count": 0}
        for row in all_units_result.all()
        if row[0] not in inspected_unit_ids
    ]

    # All units with their inspection counts (inspected first, then not inspected)
    all_units_display = inspected_units + not_inspected_units

    coverage_rate = round(len(inspected_unit_ids) / total_units * 100, 1) if total_units > 0 else 0

    return {
        "year": year,
        "total_units": total_units,
        "inspected_count": len(inspected_unit_ids),
        "not_inspected_count": total_units - len(inspected_unit_ids),
        "coverage_rate": coverage_rate,
        "units": all_units_display,
    }
