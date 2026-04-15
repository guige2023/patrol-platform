from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class PlanBase(BaseModel):
    name: str
    round_name: Optional[str] = None
    round_number: Optional[int] = None
    year: int
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    scope: Optional[str] = None
    focus_areas: Optional[List[str]] = []
    target_units: Optional[List[str]] = []
    authorization_letter: Optional[str] = None
    authorization_date: Optional[datetime] = None


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    round_name: Optional[str] = None
    round_number: Optional[int] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    scope: Optional[str] = None
    focus_areas: Optional[List[str]] = None
    target_units: Optional[List[str]] = None
    status: Optional[str] = None
    authorization_letter: Optional[str] = None
    authorization_date: Optional[datetime] = None


class PlanResponse(PlanBase):
    id: UUID
    status: str
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    version: int
    version_history: Optional[list] = []
    approval_comment: Optional[str] = None
    approved_by: Optional[UUID] = None
    is_active: bool
    created_by: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    principal_name: Optional[str] = None

    class Config:
        from_attributes = True
