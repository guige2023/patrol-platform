"""Authentication service — delegates core crypto to app.core.security"""
from datetime import timedelta, timezone
from typing import Optional
from app.core.security import (
    verify_password as _verify_password,
    get_password_hash as _get_password_hash,
    create_access_token as _create_access_token,
    verify_token as _verify_token,
)


class AuthService:
    """Auth service — delegates password/token operations to security module."""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return _verify_password(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return _get_password_hash(password)

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        return _create_access_token(data, expires_delta)

    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        return _verify_token(token)
