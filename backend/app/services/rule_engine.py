"""RuleEngine - 规则执行引擎"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Cadre, InspectionGroup, GroupMember, RuleConfig


class RuleEngine:
    """规则引擎：回避检测、智能排程、预警触发"""

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
                progress = context.get("progress", 0)
                deadline = context.get("deadline")
                if deadline and progress < 100:
                    from datetime import datetime
                    if isinstance(deadline, str):
                        deadline = datetime.fromisoformat(deadline)
                    days_left = (deadline - datetime.now()).days
                    if days_left < 0:
                        alerts.append({"level": "red", "message": "整改已超期", "rule": rule.name})
                    elif days_left <= 7:
                        alerts.append({"level": "yellow", "message": f"整改即将到期({days_left}天)", "rule": rule.name})

        return alerts
