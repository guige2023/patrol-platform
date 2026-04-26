from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_uow, get_current_user
from app.database import UnitOfWork
from app.models.user import User
from app.models.unit import Unit
from app.models.cadre import Cadre
from app.models.knowledge import Knowledge
from app.models.draft import Draft
from app.services.search_service import SearchService, INDEX_UNITS, INDEX_CADRES, INDEX_KNOWLEDGE, INDEX_DRAFTS, INDEX_ATTACHMENTS
from typing import Optional

router = APIRouter()


@router.get("/")
async def search(
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    全局全文搜索（基于 Meilisearch）
    搜索范围：单位、干部、知识库（含附件文本）、底稿
    """
    results = {}

    # 使用 Meilisearch 进行全文搜索
    if type is None or type == "all":
        # 全局搜索
        search_results = SearchService.search(q, limit=30)

        # 转换结果格式
        if INDEX_UNITS in search_results:
            results["units"] = [
                {"id": h["id"], "name": h.get("name", ""), "org_code": h.get("org_code", "")}
                for h in search_results[INDEX_UNITS]
            ]
        else:
            results["units"] = []

        if INDEX_CADRES in search_results:
            results["cadres"] = [
                {"id": h["id"], "name": h.get("name", ""), "position": h.get("position", "")}
                for h in search_results[INDEX_CADRES]
            ]
        else:
            results["cadres"] = []

        if INDEX_KNOWLEDGE in search_results:
            results["knowledge"] = [
                {"id": h["id"], "title": h.get("title", ""), "category": h.get("category", "")}
                for h in search_results[INDEX_KNOWLEDGE]
            ]
        else:
            results["knowledge"] = []

        if INDEX_DRAFTS in search_results:
            results["drafts"] = [
                {"id": h["id"], "title": h.get("title", ""), "status": h.get("status", "")}
                for h in search_results[INDEX_DRAFTS]
            ]
        else:
            results["drafts"] = []

        if INDEX_ATTACHMENTS in search_results:
            results["attachments"] = [
                {
                    "id": h["id"],
                    "filename": h.get("filename", ""),
                    "knowledge_id": h.get("knowledge_id", ""),
                    "content_snippet": (h.get("content", "") or "")[:200],  # 文本片段
                }
                for h in search_results[INDEX_ATTACHMENTS]
            ]
        else:
            results["attachments"] = []
    else:
        # 单类型搜索
        index_map = {
            "unit": INDEX_UNITS,
            "cadre": INDEX_CADRES,
            "knowledge": INDEX_KNOWLEDGE,
            "draft": INDEX_DRAFTS,
            "attachment": INDEX_ATTACHMENTS,
        }

        index_name = index_map.get(type)
        if not index_name:
            raise HTTPException(status_code=400, detail=f"未知的搜索类型: {type}")

        hits = SearchService.search_index(index_name, q, limit=30)

        if index_name == INDEX_UNITS:
            results["units"] = [{"id": h["id"], "name": h.get("name", ""), "org_code": h.get("org_code", "")} for h in hits]
        elif index_name == INDEX_CADRES:
            results["cadres"] = [{"id": h["id"], "name": h.get("name", ""), "position": h.get("position", "")} for h in hits]
        elif index_name == INDEX_KNOWLEDGE:
            results["knowledge"] = [{"id": h["id"], "title": h.get("title", ""), "category": h.get("category", "")} for h in hits]
        elif index_name == INDEX_DRAFTS:
            results["drafts"] = [{"id": h["id"], "title": h.get("title", ""), "status": h.get("status", "")} for h in hits]
        elif index_name == INDEX_ATTACHMENTS:
            results["attachments"] = [
                {
                    "id": h["id"],
                    "filename": h.get("filename", ""),
                    "knowledge_id": h.get("knowledge_id", ""),
                    "content_snippet": (h.get("content", "") or "")[:200],
                }
                for h in hits
            ]

    return results


@router.post("/rebuild")
async def rebuild_search_index(
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """重建所有搜索索引（从数据库全量导入）"""
    try:
        # 获取所有活跃记录
        unit_result = await uow.execute(select(Unit).where(Unit.is_active == True))
        units = [
            {"id": str(u.id), "name": u.name, "org_code": u.org_code or "", "category": getattr(u, "category", "") or "", "is_active": True}
            for u in unit_result.scalars().all()
        ]

        cadre_result = await uow.execute(select(Cadre).where(Cadre.is_active == True))
        cadres = [
            {
                "id": str(c.id),
                "name": c.name,
                "position": c.position or "",
                "title": c.position or "",  # 使用 position 作为 title
                "unit_name": getattr(c, "unit_name", "") or "",
                "is_active": True,
            }
            for c in cadre_result.scalars().all()
        ]

        knowledge_result = await uow.execute(select(Knowledge).where(Knowledge.is_active == True))
        knowledges = [
            {"id": str(k.id), "title": k.title or "", "content": k.content or "", "category": k.category or "", "version": k.version or "", "is_active": True}
            for k in knowledge_result.scalars().all()
        ]

        draft_result = await uow.execute(select(Draft).where(Draft.is_active == True))
        drafts = [
            {"id": str(d.id), "title": d.title or "", "content": d.content or "", "status": d.status or "", "plan_title": getattr(d, "plan_title", "") or "", "is_active": True}
            for d in draft_result.scalars().all()
        ]

        # 重建索引
        SearchService.rebuild_all_indexes(units, cadres, knowledges, drafts)

        return {
            "message": "索引重建成功",
            "stats": {
                "units": len(units),
                "cadres": len(cadres),
                "knowledges": len(knowledges),
                "drafts": len(drafts),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"索引重建失败: {str(e)}")


@router.get("/status")
async def search_status(current_user: User = Depends(get_current_user)):
    """获取搜索服务状态"""
    try:
        client = SearchService.get_client()
        health = client.health()

        # 获取各索引的文档数量
        stats = {}
        for index_name in [INDEX_UNITS, INDEX_CADRES, INDEX_KNOWLEDGE, INDEX_DRAFTS, INDEX_ATTACHMENTS]:
            try:
                index = client.index(index_name)
                stats_info = index.get_stats()
                # 只返回可序列化的字段
                stats[index_name] = {
                    "numberOfDocuments": stats_info.number_of_documents,
                    "isIndexing": stats_info.is_indexing
                }
            except Exception:
                stats[index_name] = {"numberOfDocuments": 0, "isIndexing": False}

        return {
            "status": "healthy",
            "meilisearch": health,
            "indexes": stats,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
