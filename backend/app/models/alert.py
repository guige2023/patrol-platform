import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String(32), nullable=False)  # deadline_approaching/rectification_overdue/supervision_required
    title = Column(String(256), nullable=False)
    content = Column(Text)
    entity_type = Column(String(32))  # rectification/clue/draft
    entity_id = Column(UUID(as_uuid=True))
    level = Column(String(16), default="warning")  # info/warning/critical
    is_resolved = Column(Boolean, default=False, index=True)
    resolved_by = Column(UUID(as_uuid=True))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
