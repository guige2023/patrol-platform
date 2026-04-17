from pydantic import BaseModel, Field
from typing import Generic, TypeVar, List, Optional
from datetime import datetime

T = TypeVar("T")


class Response(BaseModel, Generic[T]):
    data: Optional[T] = None
    message: str = "success"


class PageResult(BaseModel, Generic[T]):
    items: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


class PaginatedResponse(BaseModel, Generic[T]):
    data: PageResult[T]
    message: str = "success"


class BaseSchema(BaseModel):
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
