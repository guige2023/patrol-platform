from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.notification import Notification
from app.models.user import User

router = APIRouter()


@router.get("/")
async def list_notifications(
    is_read: bool = None,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    result = await uow.execute(query.order_by(Notification.created_at.desc()))
    notifications = result.scalars().all()
    return [
        {"id": n.id, "type": n.type, "title": n.title, "content": n.content, "link": n.link, "is_read": n.is_read, "created_at": n.created_at}
        for n in notifications
    ]


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: UUID, uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    result = await uow.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    if notification:
        notification.is_read = True
        await uow.commit()
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_read(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    await uow.execute(
        update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False).values(is_read=True)
    )
    await uow.commit()
    return {"message": "All marked as read"}
