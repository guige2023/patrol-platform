from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class RectificationBase(BaseModel):
    title: str
    unit_id: Optional[UUID] = None
    problem_description: str
    rectification_requirement: Optional[str] = None
    deadline: Optional[datetime] = None


class RectificationCreate(RectificationBase):
    clue_id: Optional[UUID] = None
    draft_id: Optional[UUID] = None


class RectificationUpdate(BaseModel):
    title: Optional[str] = None
    problem_description: Optional[str] = None
    rectification_requirement: Optional[str] = None
    deadline: Optional[datetime] = None
    progress: Optional[int] = None
    progress_details: Optional[List[dict]] = None
    status: Optional[str] = None
    completion_report: Optional[str] = None
    verification_comment: Optional[str] = None


class RectificationResponse(RectificationBase):
    id: UUID
    clue_id: Optional[UUID] = None
    draft_id: Optional[UUID] = None
    status: str
    progress: int
    alert_level: str
    sign_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    is_active: bool
    created_by: UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
