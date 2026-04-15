# NEXT_STEPS - 巡察平台开发记录

> 记录开发过程中的修复、功能和待办，便于后续交接和回顾。

---

## [v3.2] page_size 下拉加载修复 + birth_date 崩溃修复

**日期**: 2026-04-14

### 已完成

#### P0 - page_size 上限 100 导致下拉加载失败

所有列表 API 原本 `le=100`，前端下拉加载需 `page_size=9999` 一次性拉取全部。

| 文件 | 修复 |
|------|------|
| `backend/app/api/v1/plans.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/drafts.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/knowledge.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/rectifications.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/admin.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/dashboard.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/units.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/cadres.py` | `le=100` → `le=9999` |
| `backend/app/api/v1/clues.py` | `le=100` → `le=9999` |

验证：`curl http://localhost:18800/api/v1/units/?page=1&page_size=9999` → 76 条 ✅

#### FIX-groups - list_groups 缺少 leader_cadre_name

`GET /api/v1/groups/` 返回数据中无组长姓名，前端下拉无法显示。

修复：`groups.py` `list_groups` 和 `get_group` 添加 `leader_cadre_name` 字段，通过 `selectinload(GroupMember.cadre)` JOIN 干部表。

#### FIX-cadres - birth_date 导致 500 崩溃

Cadres 列表 API 在 `page_size=9999` 时 500 崩溃。

**根因**：`cadres.birth_date` 列存有两种格式数据：
- `"1972-10-16"`（正确）
- `"1986.08"`（浮点格式，来自旧数据导入）

`birth_date` 定义为 `Date` 类型，SQLAlchemy Cython 的 `str_to_date` 无法处理 `"1986.08"` 字符串；改为 `String` 后 Pydantic `date` 类型又拒绝浮点值。

**修复**：
1. `backend/app/models/cadre.py`：`birth_date Column(Date)` → `Column(String(32))`
2. `backend/app/schemas/cadre.py`：添加 `_normalize_birth_date` validator，`birth_date: Optional[str]`，接受 `"YYYY-MM-DD"` / `"YYYY.MM"` / 浮点数，自动规范化为 `"YYYY-MM-DD"` 字符串

验证：`curl cadres/?page_size=9999` → 154 条，无 500 ✅

### 验证结果（2026-04-14）

| 模块 | page_size=9999 |
|------|---------------|
| Units | 76 ✅ |
| Cadres | 154 ✅ |
| Plans | 26 ✅ |
| Clues | 21 ✅ |
| Drafts | 20 ✅ |
| Rectifications | 23 ✅ |
| Knowledge | 19 ✅ |
| Groups | 15 ✅ |
| Admin Users | 9 ✅ |

---

## [v3.1] 字段对齐与 Bug 修复

**日期**: 2026-04-14
**状态**: 主要修复完成

### 已完成

#### P0 - 阻断性问题

| ID | 问题 | 修复 | 验证 |
|----|------|------|------|
| P0-1 | Vite 代理端口错误导致所有 API 404/403 | `vite.config.ts` 端口 `18000` → `18800` | ✅ curl 测试通过 |
| P0-2 | 登录后所有 API 返回 403 | 后端 auth middleware 确认正常，`localStorage` 无 token 时静默失败 | ✅ 重新登录后正常 |
| P0-3 | Dashboard 统计卡片不可点击 | 确认为 React Router `<Link>` 组件，可正常跳转 | ✅ 跳转 `/bank/unit` 成功 |

#### FIX 系列 - Schema 与前端对齐

| ID | 文件 | 修复内容 | 验证 |
|----|------|----------|------|
| FIX-1 | `backend/app/schemas/plan.py` | PlanCreate/PlanUpdate 添加 `actual_start_date`、`actual_end_date`、`authorization_letter` | ✅ curl 确认 |
| FIX-2 | `backend/app/schemas/clue.py` | ClueResponse 添加 `handling_result: Optional[str]` | ✅ curl 确认 |
| FIX-4 | `frontend/.../ClueList.tsx` | `statusColors`/`statusLabels` 添加 `transferring: 'warning'/'移交中'`，移除不存在的 `processed` | ✅ 代码审查 |
| FIX-6 | `frontend/.../GroupDetail.tsx` | 替换 Modal 角色 Select 添加 `{ label: '联络员', value: '联络员' }` | ✅ 代码审查 |
| FIX-8 | `backend/app/schemas/group.py` | GroupCreate 添加 `authorization_letter`/`authorization_date`；GroupUpdate 添加 `target_unit_id` | ✅ curl 确认 |
| FIX-8 | `backend/app/schemas/rectification.py` | RectificationResponse 添加 `progress_details: Optional[List[Dict]]` | ✅ curl 确认 |
| FIX-5 | `frontend/src/api/drafts.ts` | `submitDraft` 正确传递 `inspection_group_id` 参数 | ✅ 代码审查 |
| FIX-10 | `frontend/src/api/groups.ts` | `addMember` 根据角色动态设置 `is_leader`（组长=true） | ✅ 代码审查 |

#### 组件修复

| ID | 文件 | 修复内容 |
|----|------|----------|
| CLUE-MODAL-FIX | `frontend/.../ClueModal.tsx` | STATUS_OPTIONS 添加 `transferring`；表单和 view mode 添加 `handling_result` |
| RECT-MODAL-FIX | `frontend/.../RectificationModal.tsx` | 添加 `progress_details`（TextArea，JSON 格式）和 `completion_report` 字段；`handleUpdateProgress` 支持 details 参数 |
| PLAN-DETAIL-FIX | `frontend/.../PlanDetail.tsx` | View mode 添加实际日期、状态、审批意见；表单添加 actual_date_range RangePicker、status Select、approval_comment TextArea；`handleSubmit` 发送新字段 |
| GROUP-DETAIL-FIX | `frontend/.../GroupDetail.tsx` | 替换 Modal 角色选项添加"联络员"，与新建 Modal 保持一致 |

### 后端 API 验证结果

```bash
# Plan - 新字段确认
GET /api/v1/plans/{id}
→ actual_start_date, actual_end_date, status, authorization_letter, approval_comment ✅

# Clue - handling_result 确认
GET /api/v1/clues/
→ handling_result 字段存在 ✅

# Group - 授权字段确认
GET /api/v1/groups/{id}
→ authorization_letter, authorization_date, target_unit_id ✅

# Rectification - progress_details 确认
GET /api/v1/rectifications/
→ progress_details: list [] ✅
```

---

## 待办 / 已知问题

### 中优先级

- [ ] **浏览器 Modal 测试**：AntD Modal 使用 Portal 渲染，超出 accessibility tree 范围，无法通过自动化工具验证显示效果。建议手动测试：
  - 计划详情 Modal（`PlanDetail`）- 验证实际日期、状态、审批意见字段
  - 线索详情 Modal（`ClueModal`）- 验证 `handling_result` 字段
  - 整改详情 Modal（`RectificationModal`）- 验证 `progress_details`、`completion_report` 字段
  - 巡察组详情 Modal（`GroupDetail`）- 验证联络员角色选项
- [x] **PlanDetail view mode 状态显示英文**：`status` 字段（如 `published`）在查看模式下直接显示英文而非中文标签。建议添加 `statusLabels` 映射 → ✅ 已修复；PlanList.tsx 已有完整 statusLabels/statusColors 中文映射，无需额外修复

### 低优先级

- [ ] **React Router v7 警告**：启动时 Console 有 Router API 变更警告
- [ ] **GroupMember cadre_name 为 null**：代码已正确 JOIN cadres 表（`FIX-groups`），但数据库中巡察组成员记录的 `cadre_id` 未设置，属于历史数据问题，需补充关联
- [ ] **PlanList 表格日期列为空**：数据库中 `planned_start/end_date` 为 null，这是数据问题，非代码 bug
- [ ] **Draft submit 需要验证完整流程**：从创建底稿 → 提交 → 审批 → 发布全流程端到端测试

---

## 技术笔记

### 关键路径

- 前端端口：**3000**
- 后端端口：**18800**
- Vite 代理：`/api` → `http://localhost:18800`（**注意端口不是 18000**）
- 数据库：SQLite（`backend/patrol.db`）
- 登录账号：`admin` / `admin123`

### API 响应格式

所有列表 API 返回 `{ data: { items: [], total: N } }`，前端 `api/client.ts` 自动解包外层 `data`。

### 认证流程

1. `POST /api/v1/auth/login` → 返回 `access_token`
2. 前端存 `localStorage['token']`
3. 所有 API 请求带 `Authorization: Bearer <token>`
4. 无 token 或 token 无效 → `{"detail": "Not authenticated"}`

### AntD Modal 测试注意

AntD Modal 通过 `ReactDOM.createPortal` 渲染到 `document.body`，不在 React 组件树内。浏览器自动化工具的 accessibility tree 无法捕获。建议：
- 手动点击测试
- 或通过 `document.querySelector` + JS 点击绕过 accessibility 检查

### field_options 数据

```
14 条记录，knowledge_category 字段存在
知识库 CRUD 路径：/api/v1/knowledge/（带 trailing slash）
```
