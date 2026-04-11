from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


class UnitBase(BaseModel):
    name: str
    org_code: str
    parent_id: Optional[UUID] = None
    unit_type: Optional[str] = None
    level: Optional[int] = 1
    sort_order: Optional[int] = 0
    tags: Optional[List[str]] = []
    profile: Optional[str] = None
    leadership: Optional[dict] = None
    contact: Optional[dict] = None


class UnitCreate(UnitBase):
    pass


class UnitUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    unit_type: Optional[str] = None
    level: Optional[int] = None
    sort_order: Optional[int] = None
    tags: Optional[List[str]] = None
    profile: Optional[str] = None
    leadership: Optional[dict] = None
    contact: Optional[dict] = None
    is_active: Optional[bool] = None


class UnitResponse(UnitBase):
    id: UUID
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UnitTreeResponse(UnitResponse):
    children: List["UnitTreeResponse"] = []
