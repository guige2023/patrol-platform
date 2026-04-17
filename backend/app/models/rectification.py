import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from sqlalchemy.orm import relationship
from app.database import Base


class Rectification(Base):
    __tablename__ = "rectifications"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    title = Column(String(256), nullable=False)
    plan_id = Column(Guid, ForeignKey("plans.id", ondelete="SET NULL"))
    clue_id = Column(Guid, ForeignKey("clues.id", ondelete="SET NULL"))
    draft_id = Column(Guid, ForeignKey("drafts.id", ondelete="SET NULL"))
    unit_id = Column(Guid, ForeignKey("units.id", ondelete="CASCADE"))
    problem_description = Column(Text, nullable=False)
    rectification_requirement = Column(Text)  # 整改要求
    deadline = Column(DateTime)
    status = Column(String(32), default="dispatched", index=True)  # dispatched/signed/progressing/completed/verified/rejected
    progress = Column(Integer, default=0)  # 0-100
    progress_details = Column(JSON, default=list)  # [{"date": "...", "content": "...", "percentage": 30}]
    sign_date = Column(DateTime)  # 签收日期
    sign_by = Column(Guid)  # 签收人
    completion_date = Column(DateTime)
    completion_report = Column(Text)
    verification_comment = Column(Text)
    verified_by = Column(Guid)
    verified_at = Column(DateTime)
    alert_level = Column(String(16), default="green")  # green/yellow/red
    alert_triggered_at = Column(DateTime)
    confirmed_completed = Column(Boolean, default=None)  # 确认完成
    confirm_notes = Column(Text)  # 确认意见
    confirmed_at = Column(DateTime)  # 确认时间
    confirmed_by = Column(Guid)  # 确认人
    is_active = Column(Boolean, default=True)

    unit = relationship("Unit")
    created_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
