from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class Attachment(BaseModel):
    filename: str
    url: str
    size: int
    upload_time: Optional[str] = None


class KnowledgeBase(BaseModel):
    title: str
    category: str
    content: Optional[str] = None
    version: Optional[str] = "1.0"
    tags: Optional[List[str]] = []
    source: Optional[str] = None
    effective_date: Optional[datetime] = None


class KnowledgeCreate(KnowledgeBase):
    pass


class KnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    version: Optional[str] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = None
    effective_date: Optional[datetime] = None
    is_published: Optional[bool] = None
    attachments: Optional[List[Attachment]] = None


class KnowledgeResponse(KnowledgeBase):
    id: UUID
    version_history: Optional[List[dict]] = []
    attachments: Optional[List[Attachment]] = None
    is_published: bool
    is_active: bool
    created_by: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
