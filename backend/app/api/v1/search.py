from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.unit import Unit
from app.models.cadre import Cadre
from app.models.knowledge import Knowledge
from app.models.draft import Draft
from typing import Optional

router = APIRouter()


@router.get("/")
async def search(
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    results = {}
    
    if type is None or type == "unit":
        unit_result = await uow.execute(
            select(Unit).where(Unit.is_active == True, Unit.name.ilike(f"%{q}%"))
        )
        results["units"] = [{"id": u.id, "name": u.name, "org_code": u.org_code} for u in unit_result.scalars().all()]
    
    if type is None or type == "cadre":
        cadre_result = await uow.execute(
            select(Cadre).where(Cadre.is_active == True, Cadre.name.ilike(f"%{q}%"))
        )
        results["cadres"] = [{"id": c.id, "name": c.name, "position": c.position} for c in cadre_result.scalars().all()]
    
    if type is None or type == "knowledge":
        knowledge_result = await uow.execute(
            select(Knowledge).where(Knowledge.is_active == True, Knowledge.title.ilike(f"%{q}%"))
        )
        results["knowledge"] = [{"id": k.id, "title": k.title, "category": k.category} for k in knowledge_result.scalars().all()]
    
    if type is None or type == "draft":
        draft_result = await uow.execute(
            select(Draft).where(Draft.is_active == True, Draft.title.ilike(f"%{q}%"))
        )
        results["drafts"] = [{"id": d.id, "title": d.title, "status": d.status} for d in draft_result.scalars().all()]
    
    return results
