import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer
from app.types import GUIDTypeDecorator as Guid
from app.database import Base


class FieldOption(Base):
    __tablename__ = "field_options"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    field_key = Column(String(100), unique=True, nullable=False, index=True)
    label = Column(String(200), nullable=False)
    options = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
