from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.inspection_group import InspectionGroup, GroupMember
from app.models.plan import Plan
from app.models.user import User
from app.core.audit import write_audit_log
from app.services.rule_engine import RuleEngine

router = APIRouter()


@router.get("/", response_model=List[dict])
async def list_groups(
    plan_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(InspectionGroup).where(InspectionGroup.is_active == True).options(selectinload(InspectionGroup.members))
    if plan_id:
        query = query.where(InspectionGroup.plan_id == plan_id)
    if status:
        query = query.where(InspectionGroup.status == status)
    
    result = await db.execute(query.order_by(InspectionGroup.created_at.desc()))
    groups = result.scalars().all()
    
    return [
        {
            "id": g.id,
            "name": g.name,
            "plan_id": g.plan_id,
            "status": g.status,
            "member_count": len(g.members),
            "created_at": g.created_at,
        }
        for g in groups
    ]


@router.get("/{group_id}")
async def get_group(group_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(InspectionGroup)
        .where(InspectionGroup.id == group_id)
        .options(selectinload(InspectionGroup.members).selectinload(GroupMember.cadre))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {
        "id": group.id,
        "name": group.name,
        "plan_id": group.plan_id,
        "status": group.status,
        "target_unit_id": group.target_unit_id,
        "authorization_letter": group.authorization_letter,
        "authorization_date": group.authorization_date,
        "members": [
            {"id": m.id, "cadre_id": m.cadre_id, "cadre_name": m.cadre.name, "role": m.role, "is_leader": m.is_leader}
            for m in group.members
        ],
        "created_at": group.created_at,
    }


@router.post("/")
async def create_group(
    name: str,
    plan_id: UUID,
    target_unit_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan_result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    group = InspectionGroup(
        name=name,
        plan_id=plan_id,
        target_unit_id=target_unit_id,
        created_by=current_user.id,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    await write_audit_log(db, current_user.id, "create", "inspection_group", group.id, {"name": group.name})
    return {"id": group.id, "message": "Group created"}


@router.post("/{group_id}/members")
async def add_member(
    group_id: UUID,
    cadre_id: UUID,
    role: str = "member",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(InspectionGroup).where(InspectionGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    from app.models.cadre import Cadre
    cadre_result = await db.execute(select(Cadre).where(Cadre.id == cadre_id))
    cadre = cadre_result.scalar_one_or_none()
    if not cadre:
        raise HTTPException(status_code=404, detail="Cadre not found")
    
    member = GroupMember(
        group_id=group_id,
        cadre_id=cadre_id,
        role=role,
        is_leader=(role in ["组长", "副组长"]),
    )
    db.add(member)
    await db.commit()
    await write_audit_log(db, current_user.id, "add_member", "inspection_group", group_id, {"cadre_id": str(cadre_id)})
    return {"message": "Member added"}


@router.delete("/{group_id}/members/{cadre_id}")
async def remove_member(group_id: UUID, cadre_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.cadre_id == cadre_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()
    await write_audit_log(db, current_user.id, "remove_member", "inspection_group", group_id, {"cadre_id": str(cadre_id)})
    return {"message": "Member removed"}


@router.post("/{group_id}/submit")
async def submit_group(group_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(InspectionGroup).where(InspectionGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.status = "approved"
    await db.commit()
    await write_audit_log(db, current_user.id, "submit", "inspection_group", group_id, {})
    return {"message": "Group submitted"}


@router.delete("/{group_id}")
async def delete_group(group_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(InspectionGroup).where(InspectionGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.is_active = False
    await db.commit()
    await write_audit_log(db, current_user.id, "delete", "inspection_group", group_id, {})
    return {"message": "Group deleted"}
