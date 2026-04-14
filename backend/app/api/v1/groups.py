from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from app.dependencies import get_db, get_current_user
from app.models.inspection_group import InspectionGroup, GroupMember
from app.models.plan import Plan
from app.models.cadre import Cadre
from app.models.user import User
from app.core.audit import write_audit_log
from app.services.rule_engine import RuleEngine
from app.schemas.group import GroupCreate, GroupUpdate, GroupMemberCreate

router = APIRouter()


@router.get("/")
async def list_groups(
    plan_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(InspectionGroup).where(InspectionGroup.is_active == True).options(selectinload(InspectionGroup.members).selectinload(GroupMember.cadre))
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
            "leader_cadre_name": next((m.cadre.name for m in g.members if m.is_leader and m.cadre), None),
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
        "leader_cadre_name": next((m.cadre.name for m in group.members if m.is_leader and m.cadre), None),
        "members": [
            {"id": m.id, "cadre_id": m.cadre_id, "cadre_name": m.cadre.name if m.cadre else None, "role": m.role, "is_leader": m.is_leader}
            for m in group.members
        ],
        "created_at": group.created_at,
    }


@router.post("/")
async def create_group(
    group_data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan_result = await db.execute(select(Plan).where(Plan.id == group_data.plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Use first unit_id as target_unit_id if unit_ids provided and target_unit_id not set
    target_unit_id = group_data.target_unit_id
    if not target_unit_id and group_data.unit_ids:
        target_unit_id = group_data.unit_ids[0]

    group = InspectionGroup(
        name=group_data.name,
        plan_id=group_data.plan_id,
        target_unit_id=target_unit_id,
        created_by=current_user.id,
    )
    db.add(group)
    await db.flush()  # get group.id

    # Create leader member
    if group_data.leader_id:
        leader_member = GroupMember(
            group_id=group.id,
            cadre_id=group_data.leader_id,
            role="组长",
            is_leader=True,
        )
        db.add(leader_member)

    # Create vice leader member
    if group_data.vice_leader_id:
        vice_member = GroupMember(
            group_id=group.id,
            cadre_id=group_data.vice_leader_id,
            role="副组长",
            is_leader=False,
        )
        db.add(vice_member)

    # Create regular members (skip leader/vice leader)
    for cadre_id in group_data.member_ids:
        if cadre_id == group_data.leader_id or cadre_id == group_data.vice_leader_id:
            continue
        member = GroupMember(
            group_id=group.id,
            cadre_id=cadre_id,
            role="组员",
            is_leader=False,
        )
        db.add(member)

    await db.commit()
    await db.refresh(group)
    await write_audit_log(db, current_user.id, "create", "inspection_group", group.id, {"name": group.name})
    return {"id": group.id, "name": group.name, "message": "Group created"}


@router.post("/{group_id}/members")
async def add_member(
    group_id: UUID,
    member_data: GroupMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(InspectionGroup).where(InspectionGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    cadre_result = await db.execute(select(Cadre).where(Cadre.id == member_data.cadre_id))
    cadre = cadre_result.scalar_one_or_none()
    if not cadre:
        raise HTTPException(status_code=404, detail="Cadre not found")

    member = GroupMember(
        group_id=group_id,
        cadre_id=member_data.cadre_id,
        role=member_data.role,
        is_leader=member_data.is_leader,
    )
    db.add(member)
    await db.commit()
    await write_audit_log(db, current_user.id, "add_member", "inspection_group", group_id, {"cadre_id": str(member_data.cadre_id)})
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
