import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from app.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(32), nullable=False)  # draft/rectification/knowledge
    entity_id = Column(Guid, nullable=False)
    file_name = Column(String(256), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(128), nullable=False)
    file_hash = Column(String(64))
    version = Column(Integer, default=1)
    uploaded_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
