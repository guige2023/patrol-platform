from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class UnitBase(BaseModel):
    name: str
    org_code: str
    parent_id: Optional[UUID] = None
    unit_type: Optional[str] = None
    level: Optional[str] = None
    sort_order: Optional[int] = 0
    tags: Optional[dict] = {}
    business_tags: Optional[List[str]] = []
    profile: Optional[str] = None
    leadership: Optional[dict] = None
    contact: Optional[dict] = None
    last_inspection_year: Optional[int] = None
    inspection_history: Optional[str] = None


class UnitCreate(UnitBase):
    pass


class UnitUpdate(BaseModel):
    name: Optional[str] = None
    org_code: Optional[str] = None
    parent_id: Optional[UUID] = None
    unit_type: Optional[str] = None
    level: Optional[str] = None
    sort_order: Optional[int] = None
    tags: Optional[dict] = None
    business_tags: Optional[List[str]] = None
    profile: Optional[str] = None
    leadership: Optional[dict] = None
    contact: Optional[dict] = None
    last_inspection_year: Optional[int] = None
    inspection_history: Optional[str] = None
    is_active: Optional[bool] = None


class UnitResponse(UnitBase):
    id: UUID
    is_active: bool
    last_inspection_year: Optional[int] = None
    inspection_history: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_validator('level', mode='before')
    @classmethod
    def level_to_str(cls, v):
        if v is None:
            return None
        return str(v)

    @field_validator('tags', mode='before')
    @classmethod
    def tags_list_to_dict(cls, v):
        if v is None:
            return {}
        if isinstance(v, list):
            return {} if v == [] else v
        return v

    class Config:
        from_attributes = True


class UnitTreeResponse(UnitResponse):
    children: List["UnitTreeResponse"] = []
