"""
Meilisearch 全文搜索服务
"""

import os
import meilisearch
from typing import List, Dict, Any, Optional
from datetime import datetime

# Meilisearch 配置
MEILISEARCH_URL = "http://127.0.0.1:7700"
MEILISEARCH_KEY = "patrol_platform_key"

# 索引名称
INDEX_UNITS = "units"
INDEX_CADRES = "cadres"
INDEX_KNOWLEDGE = "knowledge"
INDEX_DRAFTS = "drafts"
INDEX_ATTACHMENTS = "attachments"

# 文档 ID 前缀（用于区分不同类型的文档）
ID_PREFIX = {
    INDEX_UNITS: "u_",
    INDEX_CADRES: "c_",
    INDEX_KNOWLEDGE: "k_",
    INDEX_DRAFTS: "d_",
    INDEX_ATTACHMENTS: "a_",
}

# 中文分词器配置 (Meilisearch 内置)
CHINESE_SETTINGS = {
    "searchableAttributes": [
        "name",
        "title",
        "content",
        "category",
        "position",
        "org_code",
    ],
    "filterableAttributes": ["is_active", "type"],
    "sortableAttributes": ["created_at", "updated_at", "name", "title"],
    "displayedAttributes": ["*"],
}


class SearchService:
    _client: Optional[meilisearch.Client] = None

    @classmethod
    def get_client(cls) -> meilisearch.Client:
        if cls._client is None:
            cls._client = meilisearch.Client(MEILISEARCH_URL, MEILISEARCH_KEY)
            cls._setup_indexes()
        return cls._client

    @classmethod
    def _setup_indexes(cls):
        """初始化索引和配置"""
        client = cls._client

        # 创建并配置各个索引（使用 "id" 作为主键，id 是 UUID 格式）
        indexes_config = [
            (INDEX_UNITS, "id"),
            (INDEX_CADRES, "id"),
            (INDEX_KNOWLEDGE, "id"),
            (INDEX_DRAFTS, "id"),
            (INDEX_ATTACHMENTS, "id"),
        ]

        for index_name, primary_key in indexes_config:
            try:
                client.create_index(index_name, {"primaryKey": primary_key})
            except meilisearch.errors.MeilisearchApiError:
                pass  # 索引已存在

            # 配置中文分词
            client.index(index_name).update_settings(CHINESE_SETTINGS)

    # ==================== 索引操作 ====================

    @classmethod
    def index_unit(cls, unit: Dict[str, Any]):
        """索引单位"""
        doc = {
            "id": str(unit["id"]),
            "name": unit.get("name", ""),
            "org_code": unit.get("org_code", ""),
            "category": unit.get("category", ""),
            "is_active": unit.get("is_active", True),
            "created_at": unit.get("created_at"),
        }
        cls.get_client().index(INDEX_UNITS).add_documents([doc])

    @classmethod
    def index_cadre(cls, cadre: Dict[str, Any]):
        """索引干部"""
        doc = {
            "id": str(cadre["id"]),
            "name": cadre.get("name", ""),
            "position": cadre.get("position", ""),
            "title": cadre.get("title", ""),
            "unit_name": cadre.get("unit_name", ""),
            "is_active": cadre.get("is_active", True),
            "created_at": cadre.get("created_at"),
        }
        cls.get_client().index(INDEX_CADRES).add_documents([doc])

    @classmethod
    def index_knowledge(cls, knowledge: Dict[str, Any]):
        """索引知识库条目"""
        doc = {
            "id": str(knowledge["id"]),
            "title": knowledge.get("title", ""),
            "content": knowledge.get("content", ""),
            "category": knowledge.get("category", ""),
            "version": knowledge.get("version", ""),
            "is_active": knowledge.get("is_active", True),
            "created_at": knowledge.get("created_at"),
        }
        cls.get_client().index(INDEX_KNOWLEDGE).add_documents([doc])

    @classmethod
    def index_attachment(cls, knowledge_id: str, attachment: Dict[str, Any], content_text: str = ""):
        """索引知识库附件（包含提取的文本内容）"""
        doc = {
            "id": f"{knowledge_id}_{attachment['filename']}",
            "knowledge_id": knowledge_id,
            "filename": attachment.get("filename", ""),
            "content": content_text,  # PDF 提取的文本
            "file_type": attachment.get("file_type", ""),
            "size": attachment.get("size", 0),
            "upload_time": attachment.get("upload_time", ""),
        }
        cls.get_client().index(INDEX_ATTACHMENTS).add_documents([doc])

    @classmethod
    def index_draft(cls, draft: Dict[str, Any]):
        """索引底稿"""
        doc = {
            "id": str(draft["id"]),
            "title": draft.get("title", ""),
            "content": draft.get("content", ""),
            "status": draft.get("status", ""),
            "plan_title": draft.get("plan_title", ""),
            "is_active": draft.get("is_active", True),
            "created_at": draft.get("created_at"),
        }
        cls.get_client().index(INDEX_DRAFTS).add_documents([doc])

    # ==================== 搜索操作 ====================

    @classmethod
    def search(cls, query: str, limit: int = 20) -> Dict[str, List[Dict[str, Any]]]:
        """全局搜索所有索引"""
        if not query.strip():
            return {}

        results = {}

        # 并行搜索所有索引
        index_names = [INDEX_UNITS, INDEX_CADRES, INDEX_KNOWLEDGE, INDEX_DRAFTS, INDEX_ATTACHMENTS]

        for index_name in index_names:
            try:
                search_result = cls.get_client().index(index_name).search(
                    query,
                    {
                        "limit": limit,
                        "showMatchesPosition": True,
                    }
                )
                if search_result["hits"]:
                    # 转换结果格式
                    index_results = []
                    for hit in search_result["hits"]:
                        index_results.append(hit)
                    results[index_name] = index_results
            except Exception as e:
                print(f"[SEARCH] Error searching {index_name}: {e}")

        return results

    @classmethod
    def search_index(cls, index_name: str, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """搜索指定索引"""
        try:
            result = cls.get_client().index(index_name).search(query, {"limit": limit})
            return result["hits"]
        except Exception as e:
            print(f"[SEARCH] Error searching {index_name}: {e}")
            return []

    # ==================== 删除操作 ====================

    @classmethod
    def delete_unit(cls, unit_id: str):
        """从索引中删除单位"""
        try:
            cls.get_client().index(INDEX_UNITS).delete_document(unit_id)
        except Exception as e:
            print(f"[SEARCH] Error deleting unit {unit_id}: {e}")

    @classmethod
    def delete_cadre(cls, cadre_id: str):
        """从索引中删除干部"""
        try:
            cls.get_client().index(INDEX_CADRES).delete_document(cadre_id)
        except Exception as e:
            print(f"[SEARCH] Error deleting cadre {cadre_id}: {e}")

    @classmethod
    def delete_knowledge(cls, knowledge_id: str):
        """从索引中删除知识库条目及其附件"""
        try:
            cls.get_client().index(INDEX_KNOWLEDGE).delete_document(knowledge_id)
            # 同时删除关联的附件
            cls.get_client().index(INDEX_ATTACHMENTS).delete_documents(
                [f"{knowledge_id}_" + doc["id"] for doc in
                 cls.get_client().index(INDEX_ATTACHMENTS).search(knowledge_id, {"limit": 100})["hits"]]
            )
        except Exception as e:
            print(f"[SEARCH] Error deleting knowledge {knowledge_id}: {e}")

    @classmethod
    def delete_draft(cls, draft_id: str):
        """从索引中删除底稿"""
        try:
            cls.get_client().index(INDEX_DRAFTS).delete_document(draft_id)
        except Exception as e:
            print(f"[SEARCH] Error deleting draft {draft_id}: {e}")

    # ==================== 重建索引 ====================

    @classmethod
    def rebuild_all_indexes(cls, units: List[Dict], cadres: List[Dict], knowledges: List[Dict], drafts: List[Dict]):
        """重建所有索引（从数据库全量导入）"""
        client = cls.get_client()

        # 清空并重建各个索引
        try:
            # Units
            if units:
                client.index(INDEX_UNITS).delete_all_documents()
                unit_docs = [{
                    "id": str(u["id"]),
                    "name": u.get("name", ""),
                    "org_code": u.get("org_code", ""),
                    "category": u.get("category", ""),
                    "is_active": u.get("is_active", True),
                } for u in units]
                task = client.index(INDEX_UNITS).add_documents(unit_docs)
                client.wait_for_task(task.task_uid)

            # Cadres
            if cadres:
                client.index(INDEX_CADRES).delete_all_documents()
                cadre_docs = [{
                    "id": str(c["id"]),
                    "name": c.get("name", ""),
                    "position": c.get("position", ""),
                    "title": c.get("title", ""),
                    "unit_name": c.get("unit_name", ""),
                    "is_active": c.get("is_active", True),
                } for c in cadres]
                task = client.index(INDEX_CADRES).add_documents(cadre_docs)
                client.wait_for_task(task.task_uid)

            # Knowledges
            if knowledges:
                client.index(INDEX_KNOWLEDGE).delete_all_documents()
                knowledge_docs = [{
                    "id": str(k["id"]),
                    "title": k.get("title", ""),
                    "content": k.get("content", ""),
                    "category": k.get("category", ""),
                    "version": k.get("version", ""),
                    "is_active": k.get("is_active", True),
                } for k in knowledges]
                task = client.index(INDEX_KNOWLEDGE).add_documents(knowledge_docs)
                client.wait_for_task(task.task_uid)

            # Drafts
            if drafts:
                client.index(INDEX_DRAFTS).delete_all_documents()
                draft_docs = [{
                    "id": str(d["id"]),
                    "title": d.get("title", ""),
                    "content": d.get("content", ""),
                    "status": d.get("status", ""),
                    "plan_title": d.get("plan_title", ""),
                    "is_active": d.get("is_active", True),
                } for d in drafts]
                task = client.index(INDEX_DRAFTS).add_documents(draft_docs)
                client.wait_for_task(task.task_uid)

            print("[SEARCH] All indexes rebuilt successfully")
        except Exception as e:
            print(f"[SEARCH] Error rebuilding indexes: {e}")
