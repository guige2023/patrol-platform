import uuid
from app.types import GUIDTypeDecorator as Guid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table, JSON
# from sqlalchemy.dialects.postgresql import UUID (removed for cross-db)
from sqlalchemy.orm import relationship
from app.database import Base

# Association tables
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Guid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Guid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Guid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Guid, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(256), unique=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    full_name = Column(String(128), nullable=False)
    phone = Column(String(32))
    id_card_encrypted = Column(String(512))  # Encrypted ID card number
    is_active = Column(Boolean, default=True)
    role = Column(String(64), default="操作员")  # Simple role field (not using RBAC relation)
    unit_id = Column(Guid, ForeignKey("units.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    unit = relationship("Unit", back_populates="users")
    roles = relationship("Role", secondary=user_roles, back_populates="users")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    name = Column(String(64), unique=True, nullable=False)
    code = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(String(256))
    is_active = Column(Boolean, default=True)
    permissions = Column(JSON, default=list)  # ["unit:read", "cadre:write", ...]
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", secondary=user_roles, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Guid, primary_key=True, default=uuid.uuid4)
    code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(String(256))
    created_at = Column(DateTime, default=datetime.utcnow)
