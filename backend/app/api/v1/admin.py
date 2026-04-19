from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User, Role, Permission
from app.models.unit import Unit
from app.models.module_config import ModuleConfig
from app.models.rule_config import RuleConfig
from app.models.audit_log import AuditLog
from app.core.security import get_password_hash
from app.schemas.user import UserCreate, UserUpdate
from app.core.audit import write_audit_log

router = APIRouter()


@router.get("/users")
async def list_users(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    result = await uow.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {"id": u.id, "username": u.username, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active}
        for u in users
    ]


@router.post("/users")
async def create_user(
    user_data: UserCreate,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    existing = await uow.execute(select(User).where(User.username == user_data.username))
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
    uow.add(user)
    await uow.commit()
    await uow.refresh(user)
    await write_audit_log(uow.session, current_user.id, "create", "user", user.id, {"username": user.username})
    return {"id": user.id, "username": user.username}


@router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = user_data.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.hashed_password = get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    await uow.commit()
    await write_audit_log(uow.session, current_user.id, "update", "user", user.id, {"username": user.username})
    return {"id": user.id, "username": user.username}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await uow.commit()
    await write_audit_log(uow.session, current_user.id, "delete", "user", user.id, {"username": user.username})
    return {"message": "User deleted"}


@router.get("/audit-logs")
async def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    entity_type: str = None,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    count_result = await uow.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await uow.execute(query)
    logs = result.scalars().all()
    return {"items": [
        {"id": l.id, "user_id": l.user_id, "action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id, "created_at": l.created_at}
        for l in logs
    ], "total": total}


@router.get("/audit-logs/download")
async def export_audit_logs(
    entity_type: str = None,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Export audit logs as .xlsx."""
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    query = query.order_by(AuditLog.created_at.desc()).limit(10000)
    result = await uow.execute(query)
    logs = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "审计日志"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1677FF")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    headers = ["操作", "实体类型", "实体ID", "详情", "IP", "时间"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for l in logs:
        detail_str = str(l.detail) if l.detail else ""
        created = l.created_at.strftime('%Y-%m-%d %H:%M:%S') if l.created_at else ""
        ws.append([
            l.action or "",
            l.entity_type or "",
            str(l.entity_id) if l.entity_id else "",
            detail_str[:200],  # truncate long details
            l.ip_address or "",
            created,
        ])

    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 4, 40)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''audit_logs.xlsx"},
    )


@router.get("/modules")
async def list_modules(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    result = await uow.execute(select(ModuleConfig))
    modules = result.scalars().all()
    return modules


@router.put("/modules/{module_id}")
async def update_module(module_id: UUID, is_enabled: bool, config: dict = None, uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    result = await uow.execute(select(ModuleConfig).where(ModuleConfig.id == module_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module.is_enabled = is_enabled
    if config is not None:
        module.config = config
    await uow.commit()
    return {"message": "Module updated"}


# ─── Roles ────────────────────────────────────────────────────────────────────

@router.get("/roles")
async def list_roles(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    """List all roles."""
    result = await uow.execute(select(Role).order_by(Role.created_at.desc()))
    roles = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "code": r.code,
            "description": r.description,
            "is_active": r.is_active,
            "permissions": r.permissions or [],
            "created_at": r.created_at,
        }
        for r in roles
    ]


@router.post("/roles")
async def create_role(
    data: dict,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Create a new role."""
    name = data.get("name")
    code = data.get("code")
    if not name or not code:
        raise HTTPException(status_code=400, detail="name and code are required")
    existing = await uow.execute(select(Role).where(Role.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role code already exists")
    role = Role(
        name=name,
        code=code,
        description=data.get("description", ""),
        permissions=data.get("permissions", []),
        is_active=data.get("is_active", True),
    )
    uow.add(role)
    await uow.commit()
    await uow.refresh(role)
    await write_audit_log(uow.session, current_user.id, "create", "role", role.id, {"name": role.name})
    return {"id": role.id, "name": role.name}


@router.put("/roles/{role_id}")
async def update_role(
    role_id: UUID,
    data: dict,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Update a role."""
    result = await uow.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if "name" in data:
        role.name = data["name"]
    if "description" in data:
        role.description = data["description"]
    if "permissions" in data:
        role.permissions = data["permissions"]
    if "is_active" in data:
        role.is_active = data["is_active"]
    await uow.commit()
    await write_audit_log(uow.session, current_user.id, "update", "role", role.id, {"name": role.name})
    return {"id": role.id, "name": role.name}


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: UUID,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a role."""
    result = await uow.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.is_active = False
    await uow.commit()
    await write_audit_log(uow.session, current_user.id, "delete", "role", role.id, {"name": role.name})
    return {"message": "Role deleted"}


@router.get("/permissions")
async def list_permissions(uow: UnitOfWork = Depends(get_uow), current_user: User = Depends(get_current_user)):
    """List all available permissions."""
    result = await uow.execute(select(Permission).order_by(Permission.code))
    perms = result.scalars().all()
    return [
        {"id": p.id, "code": p.code, "name": p.name, "description": p.description}
        for p in perms
    ]
