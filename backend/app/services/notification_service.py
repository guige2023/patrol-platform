"""
notification_service.py
----------------------
所有业务事件触发通知/告警/预警的入口。
所有函数接收 uow（UnitOfWork），在调用方的同一个事务中写入数据库。
"""

from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.alert import Alert
from app.models.warning import Warning
from app.database import UnitOfWork


# ---------------------------------------------------------------------------
# 通知（notifications）— 发给指定用户
# ---------------------------------------------------------------------------

async def notify(
    uow: UnitOfWork,
    user_id: UUID,
    notif_type: str,
    title: str,
    content: str,
    link: Optional[str] = None,
) -> Notification:
    """
    创建一条通知记录。
    在调用方 commit 时一起入库。
    """
    n = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        content=content,
        link=link or "",
        is_read=False,
        created_at=datetime.now(),
    )
    uow.add(n)
    return n


async def notify_rectification_created(uow: UnitOfWork, rect_id: UUID, rect_title: str, created_by_id: UUID, sign_by_id: Optional[UUID] = None):
    """整改任务创建，通知签收人（sign_by）。"""
    target = sign_by_id if sign_by_id else created_by_id
    if not target:
        return
    await notify(
        uow,
        user_id=target,
        notif_type="rectification",
        title="【新整改任务】",
        content=f"您收到一条新整改任务：{rect_title}",
        link="/execution/rectifications",
    )


async def notify_rectification_rejected(uow: UnitOfWork, rect_id: UUID, rect_title: str, created_by_id: UUID, reason: str):
    """整改被驳回，通知创建人。"""
    if not created_by_id:
        return
    await notify(
        uow,
        user_id=created_by_id,
        notif_type="rectification",
        title="【整改被驳回】",
        content=f"您的整改「{rect_title}」被驳回，原因：{reason}",
        link="/execution/rectifications",
    )


async def notify_rectification_verified(uow: UnitOfWork, rect_id: UUID, rect_title: str, created_by_id: UUID):
    """整改审核通过，通知创建人。"""
    if not created_by_id:
        return
    await notify(
        uow,
        user_id=created_by_id,
        notif_type="rectification",
        title="【整改审核通过】",
        content=f"您的整改「{rect_title}」已审核通过。",
        link="/execution/rectifications",
    )


async def notify_rectification_confirmed(uow: UnitOfWork, rect_id: UUID, rect_title: str, created_by_id: UUID):
    """整改确认完成，通知创建人。"""
    if not created_by_id:
        return
    await notify(
        uow,
        user_id=created_by_id,
        notif_type="rectification",
        title="【整改确认完成】",
        content=f"您的整改「{rect_title}」已被确认为完成。",
        link="/execution/rectifications",
    )


async def notify_draft_action(
    uow: UnitOfWork,
    draft_id: UUID,
    draft_title: str,
    draft_creator_id: UUID,
    action: str,
    comment: Optional[str] = None,
):
    """
    底稿状态变更，通知创建者。
    action: 'preliminary_review' | 'final_review' | 'approved' | 'reject'
    """
    if not draft_creator_id:
        return
    action_labels = {
        "preliminary_review": "初审",
        "final_review": "终审",
        "approve": "审批通过",
        "reject": "被驳回",
    }
    label = action_labels.get(action, action)
    content = f"您的底稿「{draft_title}」已进入{label}阶段。"
    if comment:
        content += f" 意见：{comment}"
    await notify(
        uow,
        user_id=draft_creator_id,
        notif_type="draft",
        title=f"【底稿{label}】",
        content=content,
        link="/execution/drafts",
    )


# ---------------------------------------------------------------------------
# 告警（alerts）— 系统级重要事件
# ---------------------------------------------------------------------------

async def create_alert(
    uow: UnitOfWork,
    alert_type: str,
    title: str,
    content: str,
    level: str = "medium",
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
) -> Alert:
    """
    创建一条系统告警。
    同一 entity 已有未解决告警时不重复创建。
    """
    # 去重：同一 entity 的未解决告警
    if entity_type and entity_id:
        existing = await uow.execute(
            select(Alert).where(
                Alert.entity_type == entity_type,
                Alert.entity_id == entity_id,
                Alert.is_resolved == False,
            )
        )
        if existing.scalar_one_or_none():
            return None  # 已有未解决告警，跳过
    alert = Alert(
        type=alert_type,
        title=title,
        content=content,
        level=level,
        entity_type=entity_type or "",
        entity_id=entity_id,
        is_resolved=False,
        created_at=datetime.now(),
    )
    uow.add(alert)
    return alert


async def alert_rectification_overdue(
    uow: UnitOfWork,
    rect_id: UUID,
    rect_title: str,
    deadline: datetime,
):
    """整改超期告警"""
    days_overdue = (datetime.now() - deadline).days
    await create_alert(
        uow,
        alert_type="rectification_overdue",
        title=f"【整改超期告警】{rect_title}",
        content=f"该整改已于 {deadline.strftime('%Y-%m-%d')} 到期，已超期 {days_overdue} 天，请尽快处理。",
        level="critical" if days_overdue > 7 else "high",
        entity_type="rectifications",
        entity_id=rect_id,
    )


async def alert_plan_timeout(
    uow: UnitOfWork,
    plan_id: UUID,
    plan_name: str,
    planned_start: datetime,
):
    """巡察计划超时未启动"""
    days_late = (datetime.now() - planned_start).days
    await create_alert(
        uow,
        alert_type="plan_timeout",
        title=f"【计划超时告警】{plan_name}",
        content=f"该巡察计划应于 {planned_start.strftime('%Y-%m-%d')} 开始，已延迟 {days_late} 天。",
        level="high",
        entity_type="plans",
        entity_id=plan_id,
    )


# ---------------------------------------------------------------------------
# 预警（warnings）— 提前暴露风险
# ---------------------------------------------------------------------------

async def create_warning(
    uow: UnitOfWork,
    warning_type: str,
    title: str,
    description: str,
    level: str = "medium",
    source_type: Optional[str] = None,
    source_id: Optional[UUID] = None,
) -> Warning:
    """
    创建一条预警。
    同一 source 的未读预警不重复创建。
    """
    if source_type and source_id:
        existing = await uow.execute(
            select(Warning).where(
                Warning.source_type == source_type,
                Warning.source_id == source_id,
                Warning.is_read == False,
            )
        )
        if existing.scalar_one_or_none():
            return None
    w = Warning(
        type=warning_type,
        title=title,
        description=description,
        level=level,
        source_type=source_type or "",
        source_id=source_id,
        is_read=False,
        created_at=datetime.now(),
    )
    uow.add(w)
    return w


async def warn_rectification_deadline_approaching(
    uow: UnitOfWork,
    rect_id: UUID,
    rect_title: str,
    deadline: datetime,
    days_left: int,
):
    """整改临近截止日期预警（截止前3天）"""
    await create_warning(
        uow,
        warning_type="rectification_deadline",
        title=f"【整改即将到期】{rect_title}",
        description=f"整改「{rect_title}」将于 {deadline.strftime('%Y-%m-%d')} 到期，剩余 {days_left} 天，请抓紧完成。",
        level="high" if days_left <= 1 else "medium",
        source_type="rectifications",
        source_id=rect_id,
    )


async def warn_draft_stale(
    uow: UnitOfWork,
    draft_id: UUID,
    draft_title: str,
    days_inactive: int,
):
    """底稿长期无进展"""
    await create_warning(
        uow,
        warning_type="draft_stale",
        title=f"【底稿停滞】{draft_title}",
        description=f"底稿「{draft_title}」已有 {days_inactive} 天无进展，请及时处理或提交审核。",
        level="medium",
        source_type="drafts",
        source_id=draft_id,
    )


async def warn_plan_starting_soon(
    uow: UnitOfWork,
    plan_id: UUID,
    plan_name: str,
    planned_start: datetime,
    days_left: int,
):
    """巡察计划即将开始"""
    await create_warning(
        uow,
        warning_type="plan_starting",
        title=f"【计划即将启动】{plan_name}",
        description=f"巡察计划「{plan_name}」将于 {planned_start.strftime('%Y-%m-%d')} 启动，剩余 {days_left} 天，请做好准备工作。",
        level="low",
        source_type="plans",
        source_id=plan_id,
    )


# ---------------------------------------------------------------------------
# 定时检查（cron 调用）
# ---------------------------------------------------------------------------

async def check_overdue_and_warnings(uow: UnitOfWork):
    """
    扫描所有超期/临近截止的整改、底稿、计划，生成告警/预警。
    由 Hermes cron job 每小时调用一次。
    """
    now = datetime.now()
    today = now.date()

    # ---------- 1. 整改超期检查 + 临近截止预警 ----------
    from app.models.rectification import Rectification

    result = await uow.execute(
        select(Rectification).where(Rectification.deadline.isnot(None))
    )
    for rect in result.scalars().all():
        if rect.status in ("verified", "rejected"):
            continue  # 已终结，跳过

        deadline_date = rect.deadline.date() if hasattr(rect.deadline, 'date') else rect.deadline
        days_left = (deadline_date - today).days

        if days_left < 0:
            # 超期 → 告警
            await alert_rectification_overdue(
                uow, rect.id, rect.title, deadline=rect.deadline,
            )
        elif 0 <= days_left <= 3:
            # 临近截止 → 预警
            await warn_rectification_deadline_approaching(
                uow, rect.id, rect.title, deadline=rect.deadline, days_left=days_left,
            )

    # ---------- 2. 底稿停滞预警 ----------
    from app.models.draft import Draft

    # 7天以上无进展的底稿（仍在 draft/preliminary_review/final_review 状态）
    # 用 updated_at 判断停滞（created_at 仅衡量新建后未动的时长，不够准确）
    result = await uow.execute(
        select(Draft).where(
            Draft.status.in_(["draft", "preliminary_review", "final_review"]),
            Draft.is_active == True,
        )
    )
    for draft in result.scalars().all():
        ref_at = draft.updated_at or draft.created_at
        if not ref_at:
            continue
        inactive_days = (now - ref_at).days
        if inactive_days >= 7:
            await warn_draft_stale(uow, draft.id, draft.title, days_inactive=inactive_days)

    # ---------- 3. 计划即将启动预警 ----------
    from app.models.plan import Plan

    # 7天内应启动但还未启动的计划
    upcoming_threshold = now + timedelta(days=7)
    result = await uow.execute(
        select(Plan).where(
            Plan.status == "published",
            Plan.planned_start_date <= upcoming_threshold,
            Plan.planned_start_date >= now,
        )
    )
    for plan in result.scalars().all():
        if not plan.planned_start_date:
            continue
        days_left = (plan.planned_start_date.date() - today).days
        await warn_plan_starting_soon(uow, plan.id, plan.name, plan.planned_start_date, days_left=max(0, days_left))

    await uow.commit()
