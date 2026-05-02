# 巡察平台修复与开发计划

> 基于静态检查和基础验证结果制定 | 日期: 2026-05-02 | 版本: 3.2.1

---

## 执行摘要

8 类问题，48 项具体改动。按优先级分 3 阶段：

| 阶段 | 范围 | 核心目标 |
|------|------|----------|
| P0 | 权限 + 文件安全 | 修复 500 错误、权限绕过、路径穿越 |
| P1 | 工程完整性 | 补依赖、测试、gitignore |
| P2 | 长期改进 | 类型安全、懒加载、API 契约 |

---

## P0 - 紧急修复（立即执行）

### P0-1. 权限检查 500 错误（CRITICAL）

**根因**: `dependencies.py` 的 `check_permission` 签名从 `(user, *perms)` 改为 `(user, db, *perms)`，但所有调用方仍是旧签名 `check_permission(current_user, "perm:read")`，传参数量不匹配导致 TypeError 500。

**修复方案**: 重构为标准 FastAPI `Depends` 风格，调用方无需传 `db`。

```python
# dependencies.py - 新风格
RequirePermission = Annotated[User, Depends(require_permission)]

async def require_permission(*required_permissions: str):
    """FastAPI 依赖：注入 current_user 并检查权限"""
    async def _check(
        user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        # 权限检查逻辑...
        return user
    return _check
```

**调用方改为**:
```python
# admin.py - 修复后
@router.get("/users")
async def list_users(
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(require_permission("user:read")),
):
```

**涉及文件**:
- [ ] `backend/app/dependencies.py` - 重构 `check_permission` → `require_permission`
- [ ] `backend/app/api/v1/admin.py` - 改 8 处调用
- [ ] `backend/app/api/v1/field_options.py` - 改 4 处调用
- [ ] `backend/app/api/v1/units.py` - **补全缺失的写接口权限** (create/update/delete/import)
- [ ] `backend/app/api/v1/plans.py` - **补全缺失的写接口权限** (create/submit/approve/publish/delete/status)
- [ ] 检查其他所有 API 文件是否有类似调用

**验收**: 非超级管理员访问 `/admin/users` 等接口 → 返回 403，不是 500

---

### P0-2. 写接口权限补全（HIGH）

**units.py 补全**:
```python
@router.post("/", response_model=UnitResponse, status_code=201)
async def create_unit(...):
    await require_permission("unit:write")  # 新增
    ...

@router.put("/{unit_id}", response_model=UnitResponse)
async def update_unit(...):
    await require_permission("unit:write")  # 新增
    ...

@router.delete("/{unit_id}")
async def delete_unit(...):
    await require_permission("unit:delete")  # 新增
    ...

@router.post("/import")
async def import_units(...):
    await require_permission("unit:write")  # 新增
    ...
```

**plans.py 补全**:
```python
@router.post("/", status_code=201)
async def create_plan(...):
    await require_permission("plan:write")  # 新增
    ...

@router.put("/{plan_id}")
async def update_plan(...):
    await require_permission("plan:write")  # 新增
    ...

@router.post("/{plan_id}/submit")
async def submit_plan(...):
    await require_permission("plan:submit")  # 新增
    ...

@router.post("/{plan_id}/approve")
async def approve_plan(...):
    await require_permission("plan:approve")  # 新增
    ...

@router.post("/{plan_id}/publish")
async def publish_plan(...):
    await require_permission("plan:publish")  # 新增
    ...

@router.delete("/{plan_id}")
async def delete_plan(...):
    await require_permission("plan:delete")  # 新增
    ...

@router.post("/{plan_id}/status")
async def update_plan_status(...):
    await require_permission("plan:write")  # 新增
    ...
```

---

### P0-3. 文件上传安全收紧（HIGH）

**files.py 问题**:
1. 文件先全部读入内存，再检查大小（内存耗尽风险）
2. MIME 类型来自客户端（伪造风险）
3. 扩展名检查而非内容检查

**修复**:
```python
# 流式读取 + 先检查大小
content = await file.read()
if len(content) > MAX_FILE_SIZE:  # 50MB
    raise HTTPException(status_code=413, detail="文件大小超过限制（最大 50MB）")
# 验证 MIME 类型（可选，简单扩展名白名单已足够）
ALLOWED_MIME_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
```

**knowledge_files.py 问题**:
1. 无大小限制，LibreOffice 转换可被大文件拖垮
2. 已在前面修复 path traversal

**修复**:
```python
MAX_KNOWLEDGE_FILE_SIZE = 100 * 1024 * 1024  # 100MB（含转换后 PDF）
if len(content) > MAX_KNOWLEDGE_FILE_SIZE:
    raise HTTPException(status_code=413, detail="文件大小超过限制（最大 100MB）")
```

**通用下载 path traversal**:
```python
# files.py download_file - 添加路径校验
real_upload_dir = os.path.realpath(UPLOAD_DIR)
real_file_path = os.path.realpath(f.file_path)
if not real_file_path.startswith(real_upload_dir + os.sep):
    raise HTTPException(status_code=403, detail="无效的文件路径")
```

---

## P1 - 工程完整性（第二天）

### P1-1. 补齐 requirements.txt

**缺失**: `PyMuPDF` (fitz)

```
PyMuPDF==1.23.26
```

**验证方法**: `pip install -r requirements.txt && python -c "import fitz; print(fitz.version)"`

---

### P1-2. 完善 .gitignore

```gitignore
# Runtime directories
/runtime/
backend/runtime/
frontend/.vite/
```

---

### P1-3. 前端类型安全改进（持续）

**高频页面 any 替换优先级**:
1. `api/client.ts` - API 响应类型
2. `pages/plan/*` - 计划相关页面
3. `pages/dashboard/*` - 仪表盘

**验收**: `npm run lint` warnings 从 236 降到 < 50

---

### P1-4. ECharts 懒加载

```typescript
// 不在首屏直接加载 echarts
const EChartsComponent = dynamic(() => import('@/components/ECharts'), { ssr: false });

// 或在 Dashboard 页面用 React.lazy + Suspense
const DashboardCharts = React.lazy(() => import('./DashboardCharts'));
```

---

## P2 - 长期改进（第三天起）

### P2-1. API 响应契约统一

**现状**: 有的接口返回 `{data: X, message: "success"}`，有的直接返回 X，前端 client.ts 需猜测形状。

**方案**: 统一为标准格式，后端每个接口显式返回 `{"data": ..., "message": "..."}` 或直接 Pydantic model，前端不再需要解包装。

---

### P2-2. 权限矩阵测试

```python
# tests/test_permissions.py
import pytest
from httpx import AsyncClient

@pytest.mark.parametrize("role,endpoint,method,expected_status", [
    ("admin", "/api/v1/admin/users", "GET", 200),
    ("operator", "/api/v1/admin/users", "GET", 403),
    ("operator", "/api/v1/plans/", "POST", 403),
    ("admin", "/api/v1/plans/", "POST", 201),
])
async def test_permission_matrix(role, endpoint, method, expected_status):
    ...
```

---

## 变更清单汇总

### 后端文件（21 个）
| 文件 | 改动数 | 描述 |
|------|--------|------|
| `app/dependencies.py` | 1 | 重构 `check_permission` → `require_permission` |
| `app/api/v1/admin.py` | 8 | 改 `check_permission` 调用 |
| `app/api/v1/field_options.py` | 4 | 改 `check_permission` 调用 |
| `app/api/v1/units.py` | 6 | 补权限 + 修复 signature |
| `app/api/v1/plans.py` | 8 | 补权限 + 修复 signature |
| `app/api/v1/files.py` | 3 | 流式读取 + MIME + path traversal |
| `app/api/v1/knowledge_files.py` | 2 | 大小限制 |
| `app/api/v1/knowledge.py` | 1 | 补权限调用 |
| `app/api/v1/drafts.py` | 1 | 补权限调用 |
| `app/api/v1/progress.py` | 1 | 补权限调用 |
| `app/api/v1/cadres.py` | 1 | 补权限调用 |
| `app/api/v1/clues.py` | 1 | 补权限调用 |
| `app/api/v1/groups.py` | 1 | 补权限调用 |
| `app/api/v1/rectifications.py` | 1 | 补权限调用 |
| `app/api/v1/warnings.py` | 1 | 补权限调用 |
| `app/api/v1/documents.py` | 1 | 补权限调用 |
| `requirements.txt` | 1 | 补 PyMuPDF |
| `app/main.py` | - | 已在上一轮修复 |
| `app/core/encryption.py` | - | 已在上一轮修复 |
| `app/core/audit.py` | - | 已在上一轮修复 |
| `app/database.py` | - | 已在上一轮修复 |

### 前端文件（1 个）
| 文件 | 改动 |
|------|------|
| `src/api/client.ts` | 改进类型定义 |

### 配置文件（1 个）
| 文件 | 改动 |
|------|------|
| `.gitignore` | 补 runtime/ |

---

## 验收标准

- [ ] `cd backend && python -m py_compile .` 无错误
- [ ] `cd backend && pytest -q` 全部通过（不允许 skipped）
- [ ] 非超级管理员访问任意写接口 → 403
- [ ] 知识库上传 100MB+ 文件 → 413
- [ ] `npm run build` 通过
- [ ] `npm run lint 2>&1 | grep -c warning` < 50

---

## 风险与回滚

| 改动 | 风险 | 回滚方案 |
|------|------|----------|
| `check_permission` 重构 | 高 - 影响所有写接口 | 如有问题 revert 到旧签名并修复调用方 |
| 权限补全 | 中 - 可能阻断正常用户操作 | 添加角色时同时配置权限 |
| 文件大小限制 | 低 - 仅影响超大文件上传 | 调整 `MAX_*_SIZE` 常量 |
