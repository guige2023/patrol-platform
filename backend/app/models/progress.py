import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Progress(Base):
    """巡察进度周报"""
    __tablename__ = "progress"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    plan_id = Column(Guid, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Guid, ForeignKey("inspection_groups.id", ondelete="CASCADE"), nullable=True, index=True)
    week_number = Column(Integer, nullable=False, comment="周序号")
    report_date = Column(DateTime, nullable=False, comment="报告日期")
    talk_count = Column(Integer, default=0, comment="谈话人数")
    doc_review_count = Column(Integer, default=0, comment="查阅文档数")
    petition_count = Column(Integer, default=0, comment="信访数量")
    visit_count = Column(Integer, default=0, comment="走访数量")
    problem_total = Column(Integer, default=0, comment="发现问题总数")
    problem_party = Column(Integer, default=0, comment="党的领导问题数")
    problem_pty = Column(Integer, default=0, comment="党的建设问题数")
    problem_key = Column(Integer, default=0, comment="重点领域问题数")
    next_week_plan = Column(Text, comment="下周工作计划")
    notes = Column(Text, comment="备注")
    is_active = Column(Boolean, default=True)
    created_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("Plan")
    group = relationship("InspectionGroup")
