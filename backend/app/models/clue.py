import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Clue(Base):
    __tablename__ = "clues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(64))  # 来信来访/上级转办/监督检查发现
    source_detail = Column(String(256))
    category = Column(String(32))  # 违反廉洁纪律/工作纪律/生活纪律/其他
    severity = Column(String(16))  # mild/moderate/severe
    status = Column(String(32), default="registered", index=True)  # registered/transferring/transferred/closed
    transfer_target = Column(String(128))  # 移交去向
    transfer_date = Column(DateTime)
    transfer_comment = Column(Text)
    handling_result = Column(Text)
    is_high_confidential = Column(Boolean, default=False)
    registered_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
