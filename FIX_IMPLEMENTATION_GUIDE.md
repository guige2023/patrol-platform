# 代码审查 - 修复实施指南

**项目**: 巡察工作管理平台  
**创建时间**: 2026-05-02  
**版本**: 1.0

---

## 目录
1. [CRITICAL 问题修复](#critical-问题修复)
2. [HIGH 优先级修复](#high-优先级修复)
3. [MEDIUM 优先级改进](#medium-优先级改进)
4. [测试和验证](#测试和验证)

---

## CRITICAL 问题修复

### 修复 C5: 路径遍历漏洞

**文件**: `backend/app/api/v1/knowledge_files.py`

**修复步骤**:

#### 1. 修改 download_attachment 函数

```python
# 原代码位置：L237-270

# ❌ 原代码（有路径遍历风险）
@router.get("/{knowledge_id}/attachments/{filename}/download")
async def download_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    watermark: bool = Query(False, description="是否添加水印"),
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")
    
    att = None
    for item in knowledge.attachments or []:
        if item["filename"] == filename:
            att = item
            break
    if not att:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    safe_filename = att["url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_BASE, str(knowledge_id), safe_filename)
    # ... 不安全！

# ✓ 改进后的代码
@router.get("/{knowledge_id}/attachments/{filename}/download")
async def download_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    watermark: bool = Query(False, description="是否添加水印"),
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """下载附件（支持水印）"""
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")
    
    # ✓ 第1步：从已验证的数据库数据中查找附件
    attachment = None
    for att in knowledge.attachments or []:
        if att.get("filename") == filename:
            attachment = att
            break
    
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    # ✓ 第2步：从数据库记录的 URL 中提取安全的文件名
    safe_filename = attachment.get("url", "").split("/")[-1]
    
    # ✓ 第3步：验证 safe_filename 不包含危险字符
    if not safe_filename or ".." in safe_filename or safe_filename.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # ✓ 第4步：构建文件路径
    file_path = os.path.join(UPLOAD_BASE, str(knowledge_id), safe_filename)
    
    # ✓ 第5步：验证文件路径在允许的目录内（防御 symlink 攻击）
    import os
    real_path = os.path.realpath(file_path)
    base_path = os.path.realpath(UPLOAD_BASE)
    if not real_path.startswith(base_path):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # ✓ 第6步：检查文件是否存在
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # 读取文件内容
    async with aiofiles.open(file_path, "rb") as f:
        file_bytes = await f.read()
    
    # 获取 MIME 类型
    media_type = attachment.get("mime_type", "application/octet-stream")
    download_filename = attachment.get("original_filename") or attachment.get("filename")
    
    if watermark:
        file_bytes = apply_watermark(
            file_bytes, download_filename,
            username=current_user.full_name,
            date_str=datetime.now().strftime("%Y-%m-%d")
        )
        name_part = download_filename.rsplit(".", 1)
        if len(name_part) == 2:
            download_filename = f"{name_part[0]}_watermarked.{name_part[1]}"
        else:
            download_filename = f"{download_filename}_watermarked"
    
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition(download_filename, "attachment")},
    )
```

#### 2. 修改 delete_attachment 函数

```python
# 原代码位置：L271-310

# ✓ 改进后的代码
@router.delete("/{knowledge_id}/attachments/{filename}")
async def delete_attachment(
    knowledge_id: uuid.UUID,
    filename: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    """删除附件"""
    result = await uow.execute(select(Knowledge).where(Knowledge.id == knowledge_id))
    knowledge = result.scalar_one_or_none()
    if not knowledge:
        raise HTTPException(status_code=404, detail="知识库条目不存在")
    
    # ✓ 验证用户有权限删除
    # (可选) if knowledge.created_by != current_user.id:
    #     raise HTTPException(status_code=403, detail="Forbidden")
    
    attachments = (knowledge.attachments or [])[:]
    
    # ✓ 查找附件
    idx = None
    for i, att in enumerate(attachments):
        if att.get("filename") == filename:
            idx = i
            break
    
    if idx is None:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    # ✓ 从已验证的附件信息获取文件名
    att = attachments[idx]
    safe_filename = att.get("url", "").split("/")[-1]
    
    # ✓ 验证路径安全性
    if not safe_filename or ".." in safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = os.path.join(UPLOAD_BASE, str(knowledge_id), safe_filename)
    
    # ✓ 验证路径在允许的目录内
    real_path = os.path.realpath(file_path)
    base_path = os.path.realpath(UPLOAD_BASE)
    if not real_path.startswith(base_path):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # 删除文件
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # 从搜索索引中删除
    try:
        attachment_doc_id = f"{knowledge_id}_{att['filename']}"
        SearchService.get_client().index("attachments").delete_document(attachment_doc_id)
    except Exception as e:
        logger.error("Failed to remove attachment from index", exc_info=True)
    
    # 从列表中删除
    attachments.pop(idx)
    knowledge.attachments = attachments if attachments else None
    await uow.flush()
    await uow.commit()
    
    return {"message": "Attachment deleted"}
```

---

### 修复 C6: 前端 Token 存储

**文件**: `frontend/src/api/client.ts`

#### 方案 A: 改用 httpOnly Cookie（推荐）

**后端修改** - `backend/app/api/v1/auth.py`:

```python
from fastapi.responses import JSONResponse

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response, uow: UnitOfWork = Depends(get_uow)):
    result = await uow.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # ✓ 设置 httpOnly Cookie
    response = JSONResponse(
        {
            "user": UserInfo(
                id=user.id,
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                unit_id=user.unit_id,
            )
        }
    )
    
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,          # JavaScript 无法访问
        secure=True,            # HTTPS only（生产环境）
        samesite="strict",      # CSRF 防护
        max_age=86400,          # 24小时
        path="/",
    )
    
    return response
```

**前端修改** - `frontend/src/api/client.ts`:

```typescript
// ❌ 旧方式
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✓ 新方式 - 使用 Cookie（不需要手动设置 Authorization 头）
export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,  // ✓ 关键：自动在请求中包含 cookie
});

// 登录后不需要存储 token
export function setToken(token: string): void {
  // Cookie 由浏览器自动处理，不需要在这里存储
  // 如果需要知道是否已登录，可以尝试获取当前用户信息
  console.log('Token set via httpOnly Cookie');
}

export function clearToken(): void {
  // Cookie 会通过后端的注销端点清除
  // GET /api/v1/auth/logout?set Set-Cookie: auth_token=; Max-Age=0
}
```

修改登录页面 - `frontend/src/pages/Login.tsx`:

```typescript
// ❌ 旧方式
const response = await login(username, password);
localStorage.setItem('token', response.access_token);

// ✓ 新方式
const response = await login(username, password);
// Token 已通过 httpOnly Cookie 设置，无需在这里处理
setToken(response.access_token);
```

添加注销端点 - `backend/app/api/v1/auth.py`:

```python
@router.post("/logout")
async def logout(response: Response):
    """注销用户"""
    # 清除 token cookie
    response.delete_cookie(key="auth_token", path="/")
    return {"message": "Logged out successfully"}
```

修改前端注销 - `frontend/src/pages/Login.tsx`:

```typescript
async function handleLogout() {
  try {
    await apiClient.post('/auth/logout');
    clearToken();
    navigate('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
```

---

### 修复 C7: 暴力破解防御

**文件**: `backend/app/api/v1/auth.py`

#### 步骤 1: 安装依赖

```bash
pip install slowapi python-dateutil
```

#### 步骤 2: 添加速率限制

创建 `backend/app/core/rate_limiter.py`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

#### 步骤 3: 修改认证逻辑

```python
# backend/app/api/v1/auth.py

from datetime import datetime, timedelta
from app.core.rate_limiter import limiter
from fastapi import Request
from sqlalchemy import update

# 定义登录尝试的限制
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")  # 每分钟最多 5 次请求
async def login(
    request: Request,  # 注意：添加 Request 参数
    login_request: LoginRequest,
    response: Response,
    uow: UnitOfWork = Depends(get_uow)
):
    """用户登录"""
    result = await uow.execute(select(User).where(User.username == login_request.username))
    user = result.scalar_one_or_none()
    
    # ✓ 检查账户是否被锁定
    if user and user.is_locked:
        if user.locked_until and datetime.utcnow() < user.locked_until:
            remaining = (user.locked_until - datetime.utcnow()).seconds // 60
            raise HTTPException(
                status_code=423,
                detail=f"账户已锁定，请在 {remaining} 分钟后重试"
            )
        else:
            # 解锁账户
            user.is_locked = False
            user.locked_until = None
            user.failed_login_attempts = 0
            await uow.commit()
    
    # ✓ 验证密码
    if not user or not verify_password(login_request.password, user.hashed_password):
        if user:
            # 增加失败次数
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            user.last_failed_login = datetime.utcnow()
            
            # 如果超过限制，锁定账户
            if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
                user.is_locked = True
                user.locked_until = datetime.utcnow() + LOCKOUT_DURATION
                await uow.commit()
                raise HTTPException(
                    status_code=423,
                    detail="登录失败次数过多，账户已锁定 15 分钟"
                )
            await uow.commit()
        
        # 不要透露是用户名不存在还是密码错误
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # ✓ 检查账户是否激活
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已禁用，请联系管理员")
    
    # ✓ 登录成功，重置失败计数
    user.failed_login_attempts = 0
    user.last_failed_login = None
    user.last_login = datetime.utcnow()
    await uow.commit()
    
    # 创建 token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # 设置 httpOnly Cookie
    response = JSONResponse(
        {"user": UserInfo(...)}
    )
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=86400,
    )
    
    return response
```

#### 步骤 4: 更新 User 模型

在 `backend/app/models/user.py` 中添加字段：

```python
class User(Base):
    __tablename__ = "users"
    
    # ... 现有字段 ...
    
    # ✓ 新增字段
    failed_login_attempts = Column(Integer, default=0)
    last_failed_login = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    is_locked = Column(Boolean, default=False)
    locked_until = Column(DateTime, nullable=True)
```

#### 步骤 5: 创建数据库迁移

```bash
cd backend
alembic revision --autogenerate -m "Add login security fields"
alembic upgrade head
```

---

## HIGH 优先级修复

### 修复 H1: 日志规范化

**创建日志配置**：`backend/app/core/logging.py`

```python
import structlog
import logging
import sys
from pythonjsonlogger import jsonlogger

def setup_logging(log_level=logging.INFO):
    """配置结构化日志"""
    
    # 配置 structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # 配置 Python logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )
```

**在 main.py 中初始化**：

```python
from app.core.logging import setup_logging

setup_logging()
```

**替换 print() 调用**：

在 `backend/app/api/v1/knowledge_files.py` 中：

```python
import logging

logger = logging.getLogger(__name__)

# ❌ 旧方式
# print(f"[CONVERT] Error converting to PDF: {e}")

# ✓ 新方式
logger.error("Error converting to PDF", exc_info=True)

# ❌ 旧方式
# print(f"[UPLOAD] Indexed attachment with {len(content_text)} chars of text")

# ✓ 新方式
logger.info("Indexed attachment", attachment_chars=len(content_text))
```

---

### 修复 H2: 速率限制

**在 main.py 中添加**：

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 全局速率限制中间件
@app.middleware("http")
@limiter.limit("100/minute")
async def rate_limit_middleware(request: Request, call_next):
    return await call_next(request)
```

**对特定端点应用限制**：

```python
@router.post("/upload")
@limiter.limit("30/minute")
async def upload_attachment(...):
    ...

@router.post("/search")
@limiter.limit("60/minute")
async def search(...):
    ...
```

---

### 修复 H4: 安全 HTTP 头

**在 main.py 中修改**：

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    
    # 已有的头
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # ✓ 新增关键头
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["X-Content-Security-Policy"] = response.headers["Content-Security-Policy"]
    
    # HTTPS only（生产环境）
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    
    return response
```

---

## MEDIUM 优先级改进

### 改进 M1: 删除通配符导入

**文件**: `backend/app/schemas/__init__.py`

```python
# ❌ 旧方式
from app.schemas.auth import *
from app.schemas.unit import *
from app.schemas.cadre import *
# ...

# ✓ 改为显式导入（一次性修改）
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserInfo,
    ChangePasswordRequest,
)
from app.schemas.unit import (
    UnitCreate,
    UnitUpdate,
    UnitResponse,
)
from app.schemas.cadre import (
    CadreCreate,
    CadreUpdate,
    CadreResponse,
)
# ... 等等

__all__ = [
    "LoginRequest",
    "LoginResponse",
    # ... 列出所有公共导出
]
```

---

### 改进 M3: 数据库索引

创建迁移：

```bash
alembic revision --autogenerate -m "Add missing indexes"
```

在迁移文件中：

```python
def upgrade():
    # User 表
    op.create_index('ix_users_role', 'users', ['role'])
    op.create_index('ix_users_is_active', 'users', ['is_active'])
    
    # Plan 表
    op.create_index('ix_plans_status', 'plans', ['status'])
    op.create_index('ix_plans_year', 'plans', ['year'])
    
    # 其他需要的索引
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

def downgrade():
    op.drop_index('ix_users_role', table_name='users')
    op.drop_index('ix_users_is_active', table_name='users')
    # ...
```

---

## 测试和验证

### 1. 单元测试

为每个修复创建测试：

```python
# backend/tests/test_auth_security.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login_rate_limiting():
    """测试登录速率限制"""
    for i in range(6):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "test", "password": "test"}
        )
        if i < 5:
            assert response.status_code in [401, 403]
        else:
            assert response.status_code == 429  # Too Many Requests

def test_account_lockout():
    """测试账户锁定"""
    # 5 次失败登录
    for i in range(5):
        client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "wrong"}
        )
    
    # 第 6 次应该被锁定
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "correct"}
    )
    assert response.status_code == 423  # Locked

def test_path_traversal_protection():
    """测试路径遍历防御"""
    response = client.get(
        "/api/v1/knowledge-files/123/attachments/../../etc/passwd/download"
    )
    assert response.status_code in [400, 403, 404]
```

### 2. 集成测试

```python
# backend/tests/test_integration.py
def test_httponly_cookie_auth():
    """测试 httpOnly Cookie 认证"""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "test", "password": "test"}
    )
    assert response.status_code == 200
    
    # 检查 Set-Cookie 头
    assert "Set-Cookie" in response.headers
    assert "auth_token" in response.headers["Set-Cookie"]
    assert "HttpOnly" in response.headers["Set-Cookie"]
    assert "Secure" in response.headers["Set-Cookie"]
```

### 3. 安全测试

```bash
# 使用 bandit 检查安全问题
bandit -r backend/app

# 使用 semgrep 进行更深入的检查
semgrep --config=p/security-audit backend/app
```

---

## 提交清单

在提交修复前检查：

- [ ] C5 路径遍历漏洞已修复并测试
- [ ] C6 Token 改用 httpOnly Cookie
- [ ] C7 暴力破解防御已实现
- [ ] H1 所有 print() 改为日志
- [ ] H2 速率限制已配置
- [ ] H4 安全头已添加
- [ ] 单元测试覆盖率 > 80%
- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 文档已更新

---

**预期完成时间**: 2 周（CRITICAL 问题 1 周，HIGH 问题 1 周）

