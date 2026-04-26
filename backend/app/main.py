import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.api.v1 import router as v1_router
from app.api.v1 import knowledge_files
from app.config import settings

app = FastAPI(
    title="巡察工作管理平台",
    version="3.2.0",
    description="FastAPI + React 18 + TypeScript",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")

# 静态文件服务 - 知识库上传文件
upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(os.path.join(upload_dir, "knowledge"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# 前端静态文件目录
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")


@app.get("/health")
def health():
    return {"status": "ok", "version": "3.2.0"}


@app.get("/api/health")
def api_health():
    return {"status": "ok", "version": "3.2.0"}


# 前端SPA catch-all路由 (必须在最后)
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve frontend for non-API routes"""
    # 跳过API路径和uploads
    if full_path.startswith("api/") or full_path.startswith("uploads/"):
        return JSONResponse(content={"error": "Not found", "path": full_path}, status_code=404)

    # 尝试直接服务文件
    file_path = os.path.join(frontend_dist, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    # 返回index.html (SPA)
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return JSONResponse(content={"error": "Frontend not found"}, status_code=404)


@app.get("/")
async def serve_index():
    """Serve the frontend index.html"""
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse(content={"error": "Frontend not found"}, status_code=404)
