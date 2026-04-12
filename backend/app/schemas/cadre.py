from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime


class CadreBase(BaseModel):
    name: str
    id_card_encrypted: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    ethnicity: Optional[str] = None
    native_place: Optional[str] = None
    political_status: Optional[str] = None
    education: Optional[str] = None
    degree: Optional[str] = None
    unit_id: Optional[UUID] = None
    position: Optional[str] = None
    rank: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    profile: Optional[str] = None
    resume: Optional[str] = None
    achievements: Optional[List[dict]] = []
    is_available: Optional[bool] = True


class CadreCreate(CadreBase):
    pass


class CadreUpdate(BaseModel):
    name: Optional[str] = None
    id_card_encrypted: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    ethnicity: Optional[str] = None
    native_place: Optional[str] = None
    political_status: Optional[str] = None
    education: Optional[str] = None
    degree: Optional[str] = None
    unit_id: Optional[UUID] = None
    position: Optional[str] = None
    rank: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    profile: Optional[str] = None
    resume: Optional[str] = None
    achievements: Optional[List[dict]] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None


class CadreResponse(CadreBase):
    id: UUID
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
