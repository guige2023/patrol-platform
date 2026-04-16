import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Warning(Base):
    """预警消息"""
    __tablename__ = "warnings"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    type = Column(String(32), nullable=False, index=True)  # deadline_approaching/rectification_overdue/supervision_required/uninspected_unit
    title = Column(String(256), nullable=False)
    description = Column(Text)  # description
    source_id = Column(Guid, index=True)  # related entity id
    source_type = Column(String(32))  # related entity type: rectification/clue/draft/plan/unit
    level = Column(String(16), default="warning")  # info/warning/critical
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime)
    read_by = Column(Guid)
    created_at = Column(DateTime, default=datetime.utcnow)
