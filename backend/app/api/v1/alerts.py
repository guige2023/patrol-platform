from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.alert import Alert
from app.models.user import User

router = APIRouter()


@router.get("/")
async def list_alerts(
    is_resolved: Optional[bool] = None,
    level: Optional[str] = None,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    query = select(Alert)
    if is_resolved is not None:
        query = query.where(Alert.is_resolved == is_resolved)
    if level:
        query = query.where(Alert.level == level)
    
    result = await uow.execute(query.order_by(Alert.created_at.desc()))
    alerts = result.scalars().all()
    
    return [
        {
            "id": a.id,
            "type": a.type,
            "title": a.title,
            "content": a.content,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "level": a.level,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: UUID, uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    from sqlalchemy import select
    result = await uow.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_by = current_user.id
    from datetime import datetime
    alert.resolved_at = datetime.utcnow()
    await uow.commit()
    return {"message": "Alert resolved"}
