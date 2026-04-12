import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from sqlalchemy.orm import relationship
from app.database import Base


class Unit(Base):
    __tablename__ = "units"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    name = Column(String(256), nullable=False)
    org_code = Column(String(32), unique=True, nullable=False, index=True)
    parent_id = Column(Guid, ForeignKey("units.id", ondelete="CASCADE"), index=True)
    unit_type = Column(String(32))  # province/city/county/department
    level = Column(String(20), nullable=True)  # 一级单位、二级单位
    sort_order = Column(Integer, default=0)
    tags = Column(JSON, default=list)
    profile = Column(Text)  # 单位简介
    leadership = Column(JSON)  # {"secretary": "...", "head": "..."}
    contact = Column(JSON)  # {"phone": "...", "address": "..."}
    last_inspection_year = Column(Integer, nullable=True)  # 最近一次巡察年份
    inspection_history = Column(String(1000), nullable=True)  # 巡察历史备注
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent = relationship("Unit", remote_side=[id], back_populates="children")
    children = relationship("Unit", back_populates="parent")
    users = relationship("User", back_populates="unit")
    cadres = relationship("Cadre", back_populates="unit")
