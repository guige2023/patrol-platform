"""Security utilities"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException
from app.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def require_permissions(*required_permissions: str):
    """
    权限检查装饰器。
    
    用法:
        @router.post("/users")
        @require_permissions("user:write")
        async def create_user(...):
            ...
    
    超级管理员(special_role="super_admin")拥有所有权限。
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # 从 kwargs 或 func 参数中获取 current_user
            current_user = kwargs.get('current_user')
            if current_user is None:
                for arg in args:
                    if hasattr(arg, 'id') and hasattr(arg, 'username'):
                        current_user = arg
                        break
            
            if current_user is None:
                raise HTTPException(status_code=401, detail="未认证")
            
            # 获取用户角色
            role_name = getattr(current_user, 'role', None)
            if not role_name:
                raise HTTPException(status_code=403, detail="用户没有角色")
            
            # 查询用户角色的权限
            from sqlalchemy import select
            from app.database import AsyncSessionLocal
            from app.models.user import Role
            
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(Role).where(Role.name == role_name)
                )
                role = result.scalar_one_or_none()
                
                if not role:
                    raise HTTPException(status_code=403, detail=f"角色{role_name}不存在")
                
                permissions = role.permissions or []
                
                # 超级管理员拥有所有权限
                if '*' in permissions or role.code == 'super_admin':
                    return await func(*args, **kwargs)
                
                # 检查是否有required_permissions中的任何一个
                for required in required_permissions:
                    if required not in permissions:
                        raise HTTPException(
                            status_code=403, 
                            detail=f"缺少权限: {required}"
                        )
                
            return await func(*args, **kwargs)
        
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator
