import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from app.types import GUIDTypeDecorator as Guid
from app.database import Base


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
