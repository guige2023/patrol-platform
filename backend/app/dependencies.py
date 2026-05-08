from typing import Annotated, Callable, Optional
from fastapi import Depends, HTTPException, status, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db, get_uow, UnitOfWork
from app.core.security import verify_token
from app.models.user import User, Role
from functools import wraps

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
) -> User:
    # Try Authorization header first, then fall back to httpOnly cookie
    token: Optional[str] = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        # Fallback: read from httpOnly cookie set by login
        token = request.cookies.get("access_token")
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # Eagerly load roles relationship so check_permission can access user.roles
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.roles))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account has been deactivated")
    return user


async def _check_user_permissions(
    user: User,
    db: AsyncSession,
    required_permissions: tuple,
) -> User:
    """
    Shared permission check logic used by both require_permission and check_permission.

    Uses in-memory user.roles (pre-loaded by get_current_user via selectinload) to avoid N+1.
    Falls back to legacy user.role string field only when user.roles is empty (backward compat).
    """
    if user is None:
        raise HTTPException(status_code=401, detail="未认证")

    # Build permission set from pre-loaded user.roles relationship (no extra DB query)
    permissions: set = set()
    is_super_admin = False
    has_roles = False

    if hasattr(user, 'roles') and user.roles:
        has_roles = True
        for role in user.roles:
            role_perms = role.permissions or []
            if '*' in role_perms or role.code == 'super_admin':
                is_super_admin = True
                break
            permissions.update(role_perms)

    # Backward compat: if no roles loaded, fall back to legacy user.role string field
    if not has_roles:
        role_code = getattr(user, 'role', None)
        if not role_code:
            raise HTTPException(status_code=403, detail="用户没有角色")
        if role_code == 'super_admin' or role_code == '*':
            return user
        role_result = await db.execute(
            select(Role).where((Role.name == role_code) | (Role.code == role_code))
        )
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=403, detail=f"角色{role_code}不存在")
        permissions = set(role.permissions or [])
        is_super_admin = role.code == 'super_admin' or '*' in (role.permissions or [])

    if is_super_admin or '*' in permissions:
        return user

    for required in required_permissions:
        if required not in permissions:
            raise HTTPException(
                status_code=403,
                detail=f"缺少权限: {required}"
            )

    return user


def require_permission(*required_permissions: str) -> Callable:
    """
    FastAPI 权限检查依赖工厂。

    用法（标准 Depends 风格，调用方无需传 db）:
        @router.get("/users")
        async def list_users(
            current_user: User = Depends(require_permission("user:read")),
        ):
            ...

    超级管理员拥有所有权限。
    """
    async def dependency(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        return await _check_user_permissions(current_user, db, required_permissions)

    return dependency


async def check_permission(
    user: User,
    db: AsyncSession,
    *required_permissions: str,
) -> User:
    """
    权限检查函数（兼容旧调用方式，推荐改用 require_permission）。

    参数：
        user: 当前用户（从 get_current_user 注入）
        db: 数据库会话（从 get_db 注入）
        *required_permissions: 需要的权限列表
    """
    return await _check_user_permissions(user, db, required_permissions)


CurrentUser = Annotated[User, Depends(get_current_user)]
UOW = Annotated[UnitOfWork, Depends(get_uow)]
