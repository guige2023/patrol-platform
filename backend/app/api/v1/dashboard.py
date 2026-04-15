from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from datetime import date
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.unit import Unit
from app.models.plan import Plan
from app.models.draft import Draft
from app.models.rectification import Rectification
from app.models.clue import Clue
from app.models.inspection_group import InspectionGroup

router = APIRouter()


@router.get("/overview")
async def get_overview(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit_count = await db.execute(select(func.count()).select_from(Unit).where(Unit.is_active == True))
    plan_count = await db.execute(select(func.count()).select_from(Plan).where(Plan.is_active == True))
    draft_count = await db.execute(select(func.count()).select_from(Draft).where(Draft.is_active == True))
    rect_count = await db.execute(select(func.count()).select_from(Rectification).where(Rectification.is_active == True))
    clue_count = await db.execute(select(func.count()).select_from(Clue))
    
    pending_rect = await db.execute(
        select(func.count()).select_from(Rectification).where(
            Rectification.is_active == True,
            Rectification.status.in_(["dispatched", "signed", "progressing"])
        )
    )
    
    overdue_rect = await db.execute(
        select(func.count()).select_from(Rectification).where(
            Rectification.is_active == True,
            Rectification.alert_level == "red"
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
    }


@router.get("/issues")
async def get_issue_profile(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    drafts_by_category = await db.execute(
        select(Draft.category, func.count(Draft.id))
        .where(Draft.is_active == True, Draft.category != None)
        .group_by(Draft.category)
    )
    clues_by_source = await db.execute(
        select(Clue.source, func.count(Clue.id))
        .group_by(Clue.source)
    )
    rect_by_level = await db.execute(
        select(Rectification.alert_level, func.count(Rectification.id))
        .where(Rectification.is_active == True)
        .group_by(Rectification.alert_level)
    )
    
    return {
        "drafts_by_category": [{"category": r[0], "count": r[1]} for r in drafts_by_category.all()],
        "clues_by_source": [{"source": r[0], "count": r[1]} for r in clues_by_source.all()],
        "rectifications_by_alert_level": [{"level": r[0], "count": r[1]} for r in rect_by_level.all()],
    }


@router.get("/yearly-stats")
async def get_yearly_stats(
    year: int = date.today().year,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monthly counts of plans and inspection groups for a given year."""
    months = list(range(1, 13))
    plan_counts = [0] * 12
    group_counts = [0] * 12

    # Plans per month
    plan_result = await db.execute(
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
    group_result = await db.execute(
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
