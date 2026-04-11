import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, JSON, Text, Enum
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class PlanStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    name = Column(String(256), nullable=False)
    round_name = Column(String(64))  # 第X轮巡察
    year = Column(Integer, nullable=False)
    status = Column(String(32), default=PlanStatus.DRAFT.value, index=True)
    planned_start_date = Column(DateTime)
    planned_end_date = Column(DateTime)
    actual_start_date = Column(DateTime)
    actual_end_date = Column(DateTime)
    scope = Column(Text)  # 巡察范围
    focus_areas = Column(JSON, default=list)  # 重点领域
    target_units = Column(JSON, default=list)  # 目标单位 [unit_id, ...]
    version = Column(Integer, default=1)
    version_history = Column(JSON, default=list)
    approval_comment = Column(Text)
    approved_by = Column(Guid)
    is_active = Column(Boolean, default=True)
    created_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlanVersion(Base):
    __tablename__ = "plan_versions"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    plan_id = Column(Guid, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)
    created_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
