from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class GroupMemberCreate(BaseModel):
    cadre_id: UUID
    role: str = "member"
    is_leader: bool = False


class GroupCreate(BaseModel):
    name: str
    plan_id: UUID
    target_unit_id: Optional[UUID] = None
    unit_ids: List[UUID] = []
    leader_id: Optional[UUID] = None
    vice_leader_id: Optional[UUID] = None
    member_ids: List[UUID] = []
    authorization_letter: Optional[str] = None
    authorization_date: Optional[datetime] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    target_unit_id: Optional[UUID] = None
    authorization_letter: Optional[str] = None
    authorization_date: Optional[datetime] = None


class GroupMemberResponse(BaseModel):
    id: UUID
    cadre_id: UUID
    cadre_name: Optional[str] = None
    role: str
    is_leader: bool

    class Config:
        from_attributes = True


class GroupResponse(BaseModel):
    id: UUID
    name: str
    plan_id: UUID
    target_unit_id: Optional[UUID] = None
    status: str
    authorization_letter: Optional[str] = None
    authorization_date: Optional[datetime] = None
    member_count: int = 0
    members: List[GroupMemberResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
