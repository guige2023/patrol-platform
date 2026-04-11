from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from uuid import UUID
from typing import Optional, Dict, Any


async def write_audit_log(
    db: AsyncSession,
    user_id: Optional[UUID],
    action: str,
    entity_type: str,
    entity_id: UUID,
    detail: Dict[str, Any] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Write an audit log entry. This is the ONLY way to write audit logs."""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit_log)
    await db.commit()
