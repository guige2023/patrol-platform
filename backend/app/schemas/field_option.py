from pydantic import BaseModel, ConfigDict
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
    entity_type: str
    column_name: str
    data_type: str = "text"
    label: str
    options: List[OptionItem] = []
    is_editable: bool = True
    is_required: bool = False
    is_visible: bool = True
    is_picklist: bool = False


class FieldOptionCreate(FieldOptionBase):
    pass


class FieldOptionUpdate(BaseModel):
    label: Optional[str] = None
    options: Optional[List[OptionItem]] = None
    sort_order: Optional[int] = None
    is_editable: Optional[bool] = None
    is_required: Optional[bool] = None
    is_visible: Optional[bool] = None
    is_picklist: Optional[bool] = None


class FieldOptionResponse(BaseModel):
    id: UUID
    field_key: str
    entity_type: str
    column_name: str
    data_type: str
    label: str
    options: List[OptionItem]
    sort_order: int
    is_editable: bool
    is_required: bool
    is_visible: bool
    is_picklist: bool
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
            entity_type=obj.entity_type,
            column_name=obj.column_name,
            data_type=obj.data_type or "text",
            label=obj.label,
            options=[OptionItem(**o) for o in options_list],
            sort_order=obj.sort_order or 0,
            is_editable=obj.is_editable if obj.is_editable is not None else True,
            is_required=obj.is_required if obj.is_required is not None else False,
            is_visible=obj.is_visible if obj.is_visible is not None else True,
            is_picklist=obj.is_picklist if obj.is_picklist is not None else False,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )

    model_config = ConfigDict(from_attributes=True)


class FieldOptionSummary(BaseModel):
    """轻量版响应（列表用，不含options）"""
    id: UUID
    field_key: str
    entity_type: str
    column_name: str
    data_type: str
    label: str
    sort_order: int
    is_editable: bool
    is_required: bool
    is_visible: bool
    is_picklist: bool

    model_config = ConfigDict(from_attributes=True)


class SyncResult(BaseModel):
    """Sync操作结果"""
    added: int = 0
    updated: int = 0
    skipped: int = 0
    new_fields: List[str] = []
