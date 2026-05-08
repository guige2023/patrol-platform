from fastapi import FastAPI, Request, Response, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.api.v1 import router as v1_router
from app.api.v1.auth import limiter
from app.config import settings
from app.core.security import verify_token
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

app = FastAPI(
    title="巡察工作管理平台",
    version=settings.VERSION,
    description="FastAPI + React 18 + TypeScript",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    """CSRF protection: reject state-changing requests without proper origin header."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        allowed_origins = {f"http://{h}" if not h.startswith("http") else h for h in settings.cors_origin_list}
        allowed_origins.add(settings.cors_origin_list[0] if settings.cors_origin_list else "")
        if origin and origin not in allowed_origins:
            if not (referer and any(referer.startswith(allowed) for allowed in allowed_origins)):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF protection: invalid origin"},
                )
    return await call_next(request)

app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

settings.upload_path.joinpath("knowledge").mkdir(parents=True, exist_ok=True)

if settings.SERVE_UPLOADS:
    # Authenticated file serving — replaces raw StaticFiles mount
    uploads_files = StaticFiles(directory=settings.upload_path)

    @app.get("/uploads/{path:path}")
    async def serve_upload(request: Request, path: str, authorization: Optional[str] = Header(None)):
        """Serve uploaded files with valid Bearer token OR httpOnly cookie."""
        # Try Authorization header first, then fall back to httpOnly cookie
        token: Optional[str] = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = request.cookies.get("access_token")
        if not token or not verify_token(token):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization")
        # Delegate to StaticFiles — need request object for proper handling
        static_request = Request(scope={"type": "http", "method": "GET", "path": f"/uploads/{path}",
                               "headers": [], "root_path": ""})
        return await uploads_files.get_response(path, static_request)

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

    # 安全检查：防止路径遍历
    frontend_dist_resolved = frontend_dist.resolve()
    file_path = (frontend_dist / full_path).resolve()
    if not str(file_path).startswith(str(frontend_dist_resolved)):
        return JSONResponse(content={"error": "Forbidden"}, status_code=403)

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
