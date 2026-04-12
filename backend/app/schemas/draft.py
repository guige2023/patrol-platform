from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class DraftBase(BaseModel):
    title: str
    unit_id: Optional[UUID] = None
    content: Optional[str] = None
    category: Optional[str] = None
    problem_type: Optional[str] = None
    severity: Optional[str] = None
    evidence_summary: Optional[str] = None


class DraftCreate(DraftBase):
    group_id: UUID


class DraftUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    problem_type: Optional[str] = None
    severity: Optional[str] = None
    evidence_summary: Optional[str] = None
    group_id: Optional[UUID] = None


class DraftResponse(DraftBase):
    id: UUID
    group_id: Optional[UUID] = None
    status: str
    preliminary_reviewer: Optional[UUID] = None
    preliminary_review_comment: Optional[str] = None
    final_reviewer: Optional[UUID] = None
    final_review_comment: Optional[str] = None
    approved_by: Optional[UUID] = None
    is_active: bool
    created_by: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DraftSubmitRequest(BaseModel):
    action: str  # submit/preliminary_review/final_review/approve/reject
    comment: Optional[str] = None
