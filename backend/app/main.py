from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.api.v1 import router as v1_router
from app.config import settings

app = FastAPI(
    title="巡察工作管理平台",
    version=settings.VERSION,
    description="FastAPI + React 18 + TypeScript",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

settings.upload_path.joinpath("knowledge").mkdir(parents=True, exist_ok=True)
if settings.SERVE_UPLOADS:
    app.mount("/uploads", StaticFiles(directory=settings.upload_path), name="uploads")

frontend_dist = settings.runtime_path.parent / "frontend" / "dist"


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.VERSION}


@app.get("/api/health")
def api_health():
    return {"status": "ok", "version": settings.VERSION}


# 前端SPA catch-all路由 (必须在最后)
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve frontend for non-API routes"""
    # 跳过API路径和uploads
    if full_path.startswith("api/") or full_path.startswith("uploads/"):
        return JSONResponse(content={"error": "Not found", "path": full_path}, status_code=404)

    # 尝试直接服务文件
    file_path = frontend_dist / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # 返回index.html (SPA)
    index_path = frontend_dist / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    return JSONResponse(content={"error": "Frontend not found"}, status_code=404)


@app.get("/")
async def serve_index():
    """Serve the frontend index.html"""
    index_path = frontend_dist / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse(content={"error": "Frontend not found"}, status_code=404)
