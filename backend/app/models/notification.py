import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Guid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(32), nullable=False)  # system/approval/draft/rectification
    title = Column(String(256), nullable=False)
    content = Column(String(2048), nullable=False)
    link = Column(String(512))
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
