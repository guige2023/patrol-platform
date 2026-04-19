from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.unit import Unit
from app.schemas.auth import LoginRequest, LoginResponse, UserInfo, ChangePasswordRequest
from app.core.security import verify_password, get_password_hash, create_access_token
from datetime import timedelta
from app.config import settings

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, uow: UnitOfWork = Depends(get_uow)):
    result = await uow.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    access_token = create_access_token(data={"sub": str(user.id)})
    return LoginResponse(
        access_token=access_token,
        user=UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            unit_id=user.unit_id,
        )
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        unit_id=current_user.unit_id,
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")
    current_user.hashed_password = get_password_hash(request.new_password)
    await uow.commit()
    return {"message": "Password changed successfully"}
