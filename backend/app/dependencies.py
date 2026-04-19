from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, get_uow, UnitOfWork
from app.core.security import verify_token
from app.models.user import User
import logging

logger = logging.getLogger("uvicorn.error")
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = credentials.credentials
    logger.warning(f"[AUTH] Token received: {token[:30]}..." if token else "[AUTH] No token!")
    payload = verify_token(token)
    logger.warning(f"[AUTH] Payload: {payload}")
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    logger.warning(f"[AUTH] User authenticated: {user.username}")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
UOW = Annotated[UnitOfWork, Depends(get_uow)]
