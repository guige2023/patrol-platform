from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, get_uow, UnitOfWork
from app.core.security import verify_token
from app.models.user import User, Role
from sqlalchemy import select
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def check_permission(user: User, *required_permissions: str) -> User:
    """检查用户权限。超级管理员拥有所有权限。"""
    if user is None:
        raise HTTPException(status_code=401, detail="未认证")
    
    role_code = getattr(user, 'role', None)
    if not role_code:
        raise HTTPException(status_code=403, detail="用户没有角色")
    
    # 直接使用user.role (role.code) 进行权限检查，避免额外的数据库查询
    # super_admin拥有所有权限
    if role_code == 'super_admin' or role_code == '*':
        return user
    
    # 对于其他角色，需要查询权限
    from app.database import AsyncSessionLocal
    db = AsyncSessionLocal()
    try:
        role_result = await db.execute(select(Role).where(Role.code == role_code))
        role = role_result.scalar_one_or_none()
        
        if not role:
            raise HTTPException(status_code=403, detail=f"角色{role_code}不存在")
        
        permissions = role.permissions or []
        
        # 超级管理员拥有所有权限
        if '*' in permissions or role.code == 'super_admin':
            return user
        
        # 检查是否有required_permissions中的任何一个
        for required in required_permissions:
            if required not in permissions:
                raise HTTPException(
                    status_code=403, 
                    detail=f"缺少权限: {required}"
                )
        
        return user
    finally:
        await db.close()


CurrentUser = Annotated[User, Depends(get_current_user)]
UOW = Annotated[UnitOfWork, Depends(get_uow)]
