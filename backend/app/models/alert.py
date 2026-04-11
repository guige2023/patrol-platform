import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    type = Column(String(32), nullable=False)  # deadline_approaching/rectification_overdue/supervision_required
    title = Column(String(256), nullable=False)
    content = Column(Text)
    entity_type = Column(String(32))  # rectification/clue/draft
    entity_id = Column(Guid)
    level = Column(String(16), default="warning")  # info/warning/critical
    is_resolved = Column(Boolean, default=False, index=True)
    resolved_by = Column(Guid)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
