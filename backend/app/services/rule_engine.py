"""RuleEngine - 规则执行引擎"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
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
        # 尝试解析为 JSON
        try:
            import json
            return json.loads(config.value)
        except (json.JSONDecodeError, TypeError):
            return config.value

    @staticmethod
    async def check_conflicts(db: AsyncSession, cadre_ids: List[UUID], unit_ids: List[UUID]) -> List[Dict[str, Any]]:
        """检查人员与单位之间的回避冲突"""
        conflicts = []
        for cadre_id in cadre_ids:
            result = await db.execute(
                select(Cadre).where(Cadre.id == cadre_id)
            )
            cadre = result.scalar_one_or_none()
            if cadre and cadre.unit_id in unit_ids:
                conflicts.append({
                    "cadre_id": str(cadre_id),
                    "cadre_name": cadre.name,
                    "conflict_type": "same_unit",
                    "message": f"{cadre.name} 与目标单位存在关联，需要回避",
                })
        return conflicts

    @staticmethod
    async def smart_assign(
        db: AsyncSession,
        group_id: UUID,
        required_roles: List[str],
        target_units: List[UUID],
    ) -> List[Dict[str, Any]]:
        """智能推荐巡察组成员"""
        suggestions = []
        available_cadres = await db.execute(
            select(Cadre).where(Cadre.is_available == True)
        )
        cadres = available_cadres.scalars().all()

        for cadre in cadres:
            if cadre.unit_id and cadre.unit_id not in target_units:
                suggestions.append({
                    "cadre_id": str(cadre.id),
                    "cadre_name": cadre.name,
                    "position": cadre.position,
                    "unit_id": str(cadre.unit_id),
                    "score": 85,
                    "reason": "可用且不在目标单位",
                })

        return sorted(suggestions, key=lambda x: x["score"], reverse=True)[:10]

    @staticmethod
    async def evaluate_alert_rules(db: AsyncSession, entity_type: str, entity_id: str, context: Dict) -> List[Dict]:
        """评估预警规则"""
        alerts = []

        # 获取预警配置
        warning_enabled_pending = await RuleEngine.get_system_config(db, "warning_enabled_pending", "true")
        warning_enabled_rectifying = await RuleEngine.get_system_config(db, "warning_enabled_rectifying", "true")
        warning_enabled_overdue = await RuleEngine.get_system_config(db, "warning_enabled_overdue", "true")
        advance_warning_days = await RuleEngine.get_system_config(db, "advance_warning_days", 7)

        # 确保 advance_warning_days 是整数
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
            params = rule.parameters or {}
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

                    # 使用本地时间比较
                    now = datetime.now()
                    if deadline.tzinfo:
                        deadline = deadline.replace(tzinfo=None)
                    days_left = (deadline - now).days

                    if days_left < 0:
                        # 已超期
                        if warning_enabled_overdue in ("true", True, 1, "1"):
                            alerts.append({"level": "red", "message": f"整改已超期{abs(days_left)}天", "rule": rule.name})
                    elif days_left <= advance_warning_days:
                        # 即将到期
                        if warning_enabled_rectifying in ("true", True, 1, "1"):
                            alerts.append({"level": "yellow", "message": f"整改即将到期(剩余{days_left}天)", "rule": rule.name})
                elif progress == 0 and status == "dispatched":
                    # 待整改
                    if warning_enabled_pending in ("true", True, 1, "1"):
                        alerts.append({"level": "yellow", "message": "整改任务待开始", "rule": rule.name})

        return alerts
