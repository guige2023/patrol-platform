from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ClueBase(BaseModel):
    title: str
    content: str
    source: Optional[str] = None
    source_detail: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None


class ClueCreate(ClueBase):
    pass


class ClueUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    handling_result: Optional[str] = None
    is_high_confidential: Optional[bool] = None


class ClueResponse(ClueBase):
    id: UUID
    status: str
    transfer_target: Optional[str] = None
    transfer_date: Optional[datetime] = None
    is_high_confidential: bool
    registered_by: UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
