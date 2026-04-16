import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class DocumentType(str, enum.Enum):
    """公文类型"""
    ANNOUNCEMENT = "巡察公告"
    ESTABLISHMENT = "成立通知"
    DEPLOYMENT = "部署会通知"
    FEEDBACK = "反馈意见"
    RECTIFICATION_NOTICE = "整改通知书"


class Document(Base):
    """公文管理"""
    __tablename__ = "documents"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    title = Column(String(256), nullable=False)
    doc_number = Column(String(64), comment="公文编号")
    type = Column(String(32), nullable=False, index=True, comment="公文类型")
    generate_date = Column(DateTime, nullable=False, comment="生成日期")
    generator = Column(Guid, comment="生成人")
    file_path = Column(String(512), comment="文件路径")
    file_url = Column(String(512), comment="文件URL")
    plan_id = Column(Guid, ForeignKey("plans.id", ondelete="SET NULL"), nullable=True, index=True)
    rectification_id = Column(Guid, ForeignKey("rectifications.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("Plan")
    rectification = relationship("Rectification")
