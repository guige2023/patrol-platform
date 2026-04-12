from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import json


class OptionItem(BaseModel):
    value: str
    label: str
    sort_order: int = 0


class FieldOptionBase(BaseModel):
    field_key: str
    label: str
    options: List[OptionItem]


class FieldOptionCreate(FieldOptionBase):
    pass


class FieldOptionUpdate(BaseModel):
    label: Optional[str] = None
    options: Optional[List[OptionItem]] = None
    sort_order: Optional[int] = None


class FieldOptionResponse(BaseModel):
    id: UUID
    field_key: str
    label: str
    options: List[OptionItem]
    sort_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_model(cls, obj) -> "FieldOptionResponse":
        options_list = []
        if obj.options:
            try:
                options_list = json.loads(obj.options)
            except Exception:
                options_list = []
        return cls(
            id=obj.id,
            field_key=obj.field_key,
            label=obj.label,
            options=[OptionItem(**o) for o in options_list],
            sort_order=obj.sort_order or 0,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )

    class Config:
        from_attributes = True
