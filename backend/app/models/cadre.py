import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Date, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Cadre(Base):
    __tablename__ = "cadres"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(64), nullable=False)
    id_card_encrypted = Column(String(512))  # 加密身份证
    gender = Column(String(8))  # male/female
    birth_date = Column(Date)
    ethnicity = Column(String(32))  # 民族
    native_place = Column(String(128))  # 籍贯
    political_status = Column(String(32))  # 政治面貌
    education = Column(String(32))  # 学历
    degree = Column(String(32))  # 学位
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), index=True)
    position = Column(String(128))  # 当前职务
    rank = Column(String(32))  # 职级
    tags = Column(JSON, default=list)  # ["纪检监察", "财务审计"]
    profile = Column(Text)  # 干部简历
    resume = Column(Text)  # 工作经历
    achievements = Column(JSON, default=list)  # 表彰奖励
    is_available = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    unit = relationship("Unit", back_populates="cadres")
