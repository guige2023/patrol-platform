from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class DocumentBase(BaseModel):
    title: str
    doc_number: Optional[str] = None
    type: str
    generate_date: datetime
    generator: Optional[UUID] = None
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    plan_id: Optional[UUID] = None
    rectification_id: Optional[UUID] = None


class DocumentResponse(DocumentBase):
    id: UUID
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateDocumentRequest(BaseModel):
    plan_id: UUID
    doc_type: str


class GenerateRectificationNoticeRequest(BaseModel):
    rectification_id: UUID
