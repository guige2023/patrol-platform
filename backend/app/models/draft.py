import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from sqlalchemy.orm import relationship
from app.database import Base


class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    title = Column(String(256), nullable=False)
    group_id = Column(Guid, ForeignKey("inspection_groups.id", ondelete="CASCADE"), nullable=True)
    unit_id = Column(Guid, ForeignKey("units.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(32), default="draft", index=True)  # draft/preliminary_review/final_review/approved/rejected
    content = Column(Text)  # Markdown content
    category = Column(String(32))  # economy/politics/discipline/organization/others
    problem_type = Column(String(64))  # 问题类型
    severity = Column(String(16))  # 严重程度: mild/moderate/severe
    evidence_summary = Column(Text)
    preliminary_reviewer = Column(Guid)
    preliminary_review_comment = Column(Text)
    preliminary_review_at = Column(DateTime)
    final_reviewer = Column(Guid)
    final_review_comment = Column(Text)
    final_review_at = Column(DateTime)
    approved_by = Column(Guid)
    approved_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attachments = relationship("DraftAttachment", back_populates="draft", cascade="all, delete-orphan")
    group = relationship("InspectionGroup")


class DraftAttachment(Base):
    __tablename__ = "draft_attachments"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    draft_id = Column(Guid, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(256), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(128))
    file_hash = Column(String(64))
    uploaded_by = Column(Guid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    draft = relationship("Draft", back_populates="attachments")
