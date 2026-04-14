from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


def _normalize_birth_date(v):
    """Normalize birth_date: 'YYYY-MM-DD', 'YYYY.MM', float like 1986.08 -> 'YYYY-MM-DD'"""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        s = str(v)
        if '.' in s:
            parts = s.split('.')
            year = parts[0]
            month = parts[1].ljust(2, '0')[:2]
            return f"{year}-{month}-01"
        return s
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        # YYYY-MM-DD (already normalized)
        if '-' in v and len(v) >= 10:
            return v[:10]
        # YYYY.MM format
        if '.' in v:
            parts = v.split('.')
            year = parts[0]
            month = parts[1].ljust(2, '0')[:2]
            return f"{year}-{month}-01"
        return v
    return str(v)


class CadreBase(BaseModel):
    name: str
    id_card_encrypted: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    ethnicity: Optional[str] = None
    native_place: Optional[str] = None
    political_status: Optional[str] = None
    education: Optional[str] = None
    degree: Optional[str] = None
    unit_id: Optional[UUID] = None
    position: Optional[str] = None
    rank: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[dict] = {}
    profile: Optional[str] = None
    resume: Optional[str] = None
    achievements: Optional[List[dict]] = []
    is_available: Optional[bool] = True

    @field_validator('birth_date', mode='before')
    @classmethod
    def _birth_date_from_raw(cls, v):
        return _normalize_birth_date(v)


class CadreCreate(CadreBase):
    pass


class CadreUpdate(BaseModel):
    name: Optional[str] = None
    id_card_encrypted: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    ethnicity: Optional[str] = None
    native_place: Optional[str] = None
    political_status: Optional[str] = None
    education: Optional[str] = None
    degree: Optional[str] = None
    unit_id: Optional[UUID] = None
    position: Optional[str] = None
    rank: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[dict] = None
    profile: Optional[str] = None
    resume: Optional[str] = None
    achievements: Optional[List[dict]] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None

    @field_validator('birth_date', mode='before')
    @classmethod
    def _birth_date_from_raw(cls, v):
        return _normalize_birth_date(v)


class CadreResponse(CadreBase):
    id: UUID
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
