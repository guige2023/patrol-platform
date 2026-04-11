from fastapi import APIRouter
from app.api.v1 import auth, units, cadres, knowledge, plans, groups, drafts, clues, rectifications, alerts, dashboard, admin, files, notifications, search

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(units.router, prefix="/units", tags=["单位档案"])
router.include_router(cadres.router, prefix="/cadres", tags=["干部人才库"])
router.include_router(knowledge.router, prefix="/knowledge", tags=["知识库"])
router.include_router(plans.router, prefix="/plans", tags=["巡察计划"])
router.include_router(groups.router, prefix="/groups", tags=["巡察组"])
router.include_router(drafts.router, prefix="/drafts", tags=["底稿"])
router.include_router(clues.router, prefix="/clues", tags=["线索"])
router.include_router(rectifications.router, prefix="/rectifications", tags=["整改"])
router.include_router(alerts.router, prefix="/alerts", tags=["预警"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["看板"])
router.include_router(admin.router, prefix="/admin", tags=["系统管理"])
router.include_router(files.router, prefix="/files", tags=["文件"])
router.include_router(notifications.router, prefix="/notifications", tags=["通知"])
router.include_router(search.router, prefix="/search", tags=["搜索"])
