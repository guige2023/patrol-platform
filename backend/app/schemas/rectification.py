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
    plan_id: Optional[UUID] = None
    clue_id: Optional[UUID] = None
    draft_id: Optional[UUID] = None
    alert_level: Optional[str] = "green"


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
    alert_level: Optional[str] = None
    confirmed_completed: Optional[bool] = None
    confirm_notes: Optional[str] = None


class RectificationResponse(RectificationBase):
    id: UUID
    plan_id: Optional[UUID] = None
    clue_id: Optional[UUID] = None
    draft_id: Optional[UUID] = None
    status: str
    progress: int
    progress_details: Optional[List[dict]] = None
    alert_level: str
    sign_date: Optional[datetime] = None
    sign_by: Optional[UUID] = None
    completion_date: Optional[datetime] = None
    completion_report: Optional[str] = None
    verification_comment: Optional[str] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    confirmed_completed: Optional[bool] = None
    confirm_notes: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[UUID] = None
    is_active: bool
    created_by: UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
