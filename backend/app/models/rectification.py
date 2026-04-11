import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Rectification(Base):
    __tablename__ = "rectifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(256), nullable=False)
    clue_id = Column(UUID(as_uuid=True), ForeignKey("clues.id", ondelete="SET NULL"))
    draft_id = Column(UUID(as_uuid=True), ForeignKey("drafts.id", ondelete="SET NULL"))
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="CASCADE"), nullable=False)
    problem_description = Column(Text, nullable=False)
    rectification_requirement = Column(Text)  # 整改要求
    deadline = Column(DateTime)
    status = Column(String(32), default="dispatched", index=True)  # dispatched/signed/progressing/completed/verified/rejected
    progress = Column(Integer, default=0)  # 0-100
    progress_details = Column(JSON, default=list)  # [{"date": "...", "content": "...", "percentage": 30}]
    sign_date = Column(DateTime)  # 签收日期
    sign_by = Column(UUID(as_uuid=True))  # 签收人
    completion_date = Column(DateTime)
    completion_report = Column(Text)
    verification_comment = Column(Text)
    verified_by = Column(UUID(as_uuid=True))
    verified_at = Column(DateTime)
    alert_level = Column(String(16), default="green")  # green/yellow/red
    alert_triggered_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
