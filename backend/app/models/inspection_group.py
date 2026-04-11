import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("inspection_groups.id", ondelete="CASCADE"), nullable=False)
    cadre_id = Column(UUID(as_uuid=True), ForeignKey("cadres.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(32))  # 组长/副组长/联络员/成员
    is_leader = Column(Boolean, default=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("InspectionGroup", back_populates="members")
    cadre = relationship("Cadre")


class InspectionGroup(Base):
    __tablename__ = "inspection_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(128), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(32), default="draft")  # draft/approved/active/completed
    target_unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"))
    authorization_letter = Column(Text)  # 授权书内容
    authorization_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    plan = relationship("Plan")
