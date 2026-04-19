import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1 import router as v1_router
from app.api.v1 import knowledge_files
from app.config import settings

app = FastAPI(
    title="巡察工作管理平台",
    version="3.1.0",
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
# knowledge_files.router is already included via v1_router in __init__.py (line 10)

# 静态文件服务 - 知识库上传文件
upload_dir = "backend/uploads"
os.makedirs(os.path.join(upload_dir, "knowledge"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "version": "3.1.0"}
