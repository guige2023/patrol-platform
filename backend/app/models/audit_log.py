import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Guid, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(64), nullable=False)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(Guid, nullable=False)
    detail = Column(JSON, default=dict)
    ip_address = Column(String(45))
    user_agent = Column(String(256))
    created_at = Column(DateTime, default=datetime.utcnow)
