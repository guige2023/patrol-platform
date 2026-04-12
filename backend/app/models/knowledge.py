import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from app.database import Base


class Knowledge(Base):
    __tablename__ = "knowledge"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    title = Column(String(256), nullable=False)
    category = Column(String(32), nullable=False, index=True)  # regulation/policy/dict
    content = Column(Text)  # Markdown content
    version = Column(String(16), default="1.0")
    version_history = Column(JSON, default=list)  # [{"version": "1.1", "date": "...", "change": "..."}]
    tags = Column(JSON, default=list)
    source = Column(String(256))  # 来源
    effective_date = Column(DateTime)
    is_published = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    attachments = Column(JSON, nullable=True)  # [{"filename": "...", "url": "...", "size": 123, "upload_time": "..."}]
    created_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
