import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean
from app.types import GUIDTypeDecorator as Guid
from app.database import Base


class FieldOption(Base):
    __tablename__ = "field_options"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    field_key = Column(String(100), unique=True, nullable=False, index=True)
    entity_type = Column(String(64), nullable=False, index=True)
    column_name = Column(String(64), nullable=False)
    data_type = Column(String(32), nullable=False, server_default="text")
    label = Column(String(200), nullable=False)
    options = Column(Text, nullable=False, server_default="[]")
    sort_order = Column(Integer, default=0)
    is_editable = Column(Boolean, nullable=False, server_default="true")
    is_required = Column(Boolean, nullable=False, server_default="false")
    is_visible = Column(Boolean, nullable=False, server_default="true")
    is_picklist = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
