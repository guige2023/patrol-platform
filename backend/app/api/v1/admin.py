from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.unit import Unit
from app.models.module_config import ModuleConfig
from app.models.rule_config import RuleConfig
from app.models.audit_log import AuditLog
from app.core.security import get_password_hash
from app.schemas.user import UserCreate, UserUpdate
from app.core.audit import write_audit_log

router = APIRouter()


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {"id": u.id, "username": u.username, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active}
        for u in users
    ]


@router.post("/users")
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(select(User).where(User.username == user_data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        unit_id=user_data.unit_id,
        is_active=user_data.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await write_audit_log(db, current_user.id, "create", "user", user.id, {"username": user.username})
    return {"id": user.id, "username": user.username}


@router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = user_data.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.hashed_password = get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await write_audit_log(db, current_user.id, "update", "user", user.id, {"username": user.username})
    return {"id": user.id, "username": user.username}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "user", user.id, {"username": user.username})
    return {"message": "User deleted"}


@router.get("/audit-logs")
async def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    entity_type: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()
    return {"items": [
        {"id": l.id, "user_id": l.user_id, "action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id, "created_at": l.created_at}
        for l in logs
    ], "total": total}


@router.get("/modules")
async def list_modules(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ModuleConfig))
    modules = result.scalars().all()
    return modules


@router.put("/modules/{module_id}")
async def update_module(module_id: UUID, is_enabled: bool, config: dict = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ModuleConfig).where(ModuleConfig.id == module_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module.is_enabled = is_enabled
    if config is not None:
        module.config = config
    await db.commit()
    return {"message": "Module updated"}
