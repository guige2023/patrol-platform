from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ProgressBase(BaseModel):
    plan_id: UUID
    group_id: Optional[UUID] = None
    week_number: int
    report_date: datetime
    talk_count: int = 0
    doc_review_count: int = 0
    petition_count: int = 0
    visit_count: int = 0
    problem_total: int = 0
    problem_party: int = 0
    problem_pty: int = 0
    problem_key: int = 0
    next_week_plan: Optional[str] = None
    notes: Optional[str] = None


class ProgressCreate(ProgressBase):
    pass


class ProgressUpdate(BaseModel):
    group_id: Optional[UUID] = None
    week_number: Optional[int] = None
    report_date: Optional[datetime] = None
    talk_count: Optional[int] = None
    doc_review_count: Optional[int] = None
    petition_count: Optional[int] = None
    visit_count: Optional[int] = None
    problem_total: Optional[int] = None
    problem_party: Optional[int] = None
    problem_pty: Optional[int] = None
    problem_key: Optional[int] = None
    next_week_plan: Optional[str] = None
    notes: Optional[str] = None


class ProgressResponse(ProgressBase):
    id: UUID
    is_active: bool
    created_by: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GroupOverview(BaseModel):
    """Dashboard card overview by group"""
    group_id: Optional[UUID] = None
    group_name: Optional[str] = None
    plan_id: UUID
    plan_name: Optional[str] = None
    total_reports: int = 0
    total_talks: int = 0
    total_doc_reviews: int = 0
    total_petitions: int = 0
    total_visits: int = 0
    total_problems: int = 0
    latest_report_date: Optional[datetime] = None

    class Config:
        from_attributes = True
