"""NotificationService - 通知服务"""
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Notification


class NotificationService:
    @staticmethod
    async def create(
        db: AsyncSession,
        user_id: UUID,
        title: str,
        content: str,
        notif_type: str = "info",
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
    ) -> Notification:
        """创建通知"""
        notif = Notification(
            user_id=user_id,
            title=title,
            content=content,
            notif_type=notif_type,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        db.add(notif)
        await db.commit()
        await db.refresh(notif)
        return notif

    @staticmethod
    async def create_batch(
        db: AsyncSession,
        user_ids: list[UUID],
        title: str,
        content: str,
        notif_type: str = "info",
    ) -> list[Notification]:
        """批量创建通知"""
        notifications = [
            Notification(
                user_id=uid,
                title=title,
                content=content,
                notif_type=notif_type,
            )
            for uid in user_ids
        ]
        db.add_all(notifications)
        await db.commit()
        return notifications
