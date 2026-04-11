import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class RuleConfig(Base):
    __tablename__ = "rule_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_code = Column(String(64), unique=True, nullable=False, index=True)
    rule_name = Column(String(128), nullable=False)
    rule_type = Column(String(32), nullable=False)  # avoidance/scheduling/notification/validation
    params = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
