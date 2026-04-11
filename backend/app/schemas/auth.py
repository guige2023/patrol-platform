from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: UUID
    username: str
    email: str
    full_name: str
    unit_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
