from functools import wraps
from fastapi import HTTPException, status
from typing import List


def require_permissions(*required_permissions: str):
    """Decorator to check if user has required permissions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from kwargs
            current_user = kwargs.get("current_user")
            if current_user is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
            
            # Get user permissions from roles
            user_permissions = set()
            for role in current_user.roles:
                if role.permissions:
                    user_permissions.update(role.permissions)
            
            # Check if user has all required permissions
            for perm in required_permissions:
                if perm not in user_permissions and "*" not in user_permissions:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Missing permission: {perm}"
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def check_permission(user_permissions: List[str], required_permission: str) -> bool:
    """Check if a user has a specific permission"""
    return required_permission in user_permissions or "*" in user_permissions
