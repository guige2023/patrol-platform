"""RuleEngine - 规则执行引擎"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Cadre, InspectionGroup, GroupMember, RuleConfig, SystemConfig


class RuleEngine:
    """规则引擎：回避检测、智能排程、预警触发"""

    @staticmethod
    async def get_system_config(db: AsyncSession, key: str, default: Any = None) -> Any:
        """从系统配置读取配置值"""
        result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
        config = result.scalar_one_or_none()
        if config is None:
            return default
        try:
            import json
            return json.loads(config.value)
        except (json.JSONDecodeError, TypeError):
            return config.value

    @staticmethod
    async def check_conflicts(db: AsyncSession, cadre_ids: List[UUID], unit_ids: List[UUID]) -> List[Dict[str, Any]]:
        """检查人员与单位之间的回避冲突"""
        if not cadre_ids:
            return []
        # Single query with IN clause — no N+1
        result = await db.execute(
            select(Cadre).where(Cadre.id.in_(cadre_ids))
        )
        cadres = result.scalars().all()
        return [
            {
                "cadre_id": str(cadre.id),
                "cadre_name": cadre.name,
                "conflict_type": "same_unit",
                "message": f"{cadre.name} 与目标单位存在关联，需要回避",
            }
            for cadre in cadres
            if cadre.unit_id and cadre.unit_id in unit_ids
        ]

    @staticmethod
    async def smart_assign(
        db: AsyncSession,
        group_id: UUID,
        required_roles: List[str],
        target_units: List[UUID],
    ) -> List[Dict[str, Any]]:
        """智能推荐巡察组成员"""
        # Filter at SQL level — no full table load
        if target_units:
            query = select(Cadre).where(
                Cadre.is_available == True,
                Cadre.unit_id.isnot(None),
                ~Cadre.unit_id.in_(target_units),
            )
        else:
            query = select(Cadre).where(
                Cadre.is_available == True,
                Cadre.unit_id.isnot(None),
            )
        result = await db.execute(query)
        cadres = result.scalars().all()

        suggestions = [
            {
                "cadre_id": str(cadre.id),
                "cadre_name": cadre.name,
                "position": cadre.position,
                "unit_id": str(cadre.unit_id),
                "score": 85,
                "reason": "可用且不在目标单位",
            }
            for cadre in cadres
        ]
        return sorted(suggestions, key=lambda x: x["score"], reverse=True)[:10]

    @staticmethod
    async def evaluate_alert_rules(db: AsyncSession, entity_type: str, entity_id: str, context: Dict) -> List[Dict]:
        """评估预警规则"""
        alerts = []

        warning_enabled_pending = await RuleEngine.get_system_config(db, "warning_enabled_pending", "true")
        warning_enabled_rectifying = await RuleEngine.get_system_config(db, "warning_enabled_rectifying", "true")
        warning_enabled_overdue = await RuleEngine.get_system_config(db, "warning_enabled_overdue", "true")
        advance_warning_days = await RuleEngine.get_system_config(db, "advance_warning_days", 7)

        try:
            advance_warning_days = int(advance_warning_days)
        except (ValueError, TypeError):
            advance_warning_days = 7

        result = await db.execute(
            select(RuleConfig).where(
                RuleConfig.rule_type == "alert",
                RuleConfig.is_active == True,
            )
        )
        rules = result.scalars().all()

        for rule in rules:
            if entity_type == "rectification":
                status = context.get("status", "dispatched")
                progress = context.get("progress", 0)
                deadline = context.get("deadline")

                if deadline and progress < 100:
                    if isinstance(deadline, str):
                        try:
                            deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                        except ValueError:
                            deadline = datetime.strptime(deadline, "%Y-%m-%dT%H:%M:%S")

                    # Normalize to UTC for comparison
                    now_utc = datetime.now(timezone.utc)
                    if deadline.tzinfo:
                        deadline_utc = deadline.astimezone(timezone.utc).replace(tzinfo=None)
                    else:
                        deadline_utc = deadline

                    days_left = (deadline_utc - now_utc.replace(tzinfo=None)).days

                    if days_left < 0:
                        if warning_enabled_overdue in ("true", True, 1, "1"):
                            alerts.append({"level": "red", "message": f"整改已超期{abs(days_left)}天", "rule": rule.name})
                    elif days_left <= advance_warning_days:
                        if warning_enabled_rectifying in ("true", True, 1, "1"):
                            alerts.append({"level": "yellow", "message": f"整改即将到期(剩余{days_left}天)", "rule": rule.name})
                elif progress == 0 and status == "dispatched":
                    if warning_enabled_pending in ("true", True, 1, "1"):
                        alerts.append({"level": "yellow", "message": "整改任务待开始", "rule": rule.name})

        return alerts
