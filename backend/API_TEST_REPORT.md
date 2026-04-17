# Cadre/Unit API 端点核查报告

## 测试环境
- 服务: http://localhost:18800
- 数据库: patrol.db (SQLite)
- 认证: admin / admin123

## 端点测试结果 (共 22 个)

### Cadre 端点 (11个)

| # | 端点 | 方法 | HTTP | 状态 |
|---|------|------|------|------|
| 1 | /cadres/ | GET | 200 | 正常 |
| 2 | /cadres/template | GET | 200 | 正常 (下载Excel模板) |
| 3 | /cadres/export | GET | 200 | 正常 (导出Excel) |
| 4 | /cadres/{id} | GET | 200 | 正常 |
| 5 | /cadres/ | POST | 201 | 正常 (创建干部) |
| 6 | /cadres/{id} | PUT | 200 | 正常 (更新干部) |
| 7 | /cadres/{id} | DELETE | 200 | 正常 (软删除) |
| 8 | /cadres/batch-delete | POST | 200 | 已修复 (原405→修复后200) |
| 9 | /cadres/{id}/id-card/masked | GET | 404 | 正常 (无身份证时返回404) |
| 10 | /cadres/{id}/groups | GET | 200 | 正常 (干部所在巡察组) |
| 11 | /cadres/import | POST | 400 | 正常 (空文件返回400) |

### Unit 端点 (11个)

| # | 端点 | 方法 | HTTP | 状态 |
|---|------|------|------|------|
| 12 | /units/ | GET | 200 | 已修复 (原500→修复后200) |
| 13 | /units/tree | GET | 200 | 已修复 (原500→修复后200) |
| 14 | /units/template | GET | 200 | 正常 (下载Excel模板) |
| 15 | /units/export | GET | 200 | 正常 (导出Excel) |
| 16 | /units/{id} | GET | 200 | 正常 |
| 17 | /units/ | POST | 201 | 正常 (创建单位) |
| 18 | /units/{id} | PUT | 200 | 正常 (更新单位) |
| 19 | /units/{id} | DELETE | 200 | 正常 (软删除) |
| 20 | /units/import | POST | 400 | 正常 (空文件返回400) |
| 21 | GET /units/?name=测试 | GET | 200 | 正常 (中文搜索) |
| 22 | GET /cadres/?name=测试 | GET | 200 | 正常 (中文搜索) |

## 修复的问题

### Bug 1: Unit list/tree 返回 500 (ResponseValidationError)
**根因**: `models/unit.py` 中 `tags = Column(JSON, default=list)` 存储了 `[]`，但 `schemas/unit.py` 的 `UnitResponse` 期望 `tags: Optional[dict] = {}`，Pydantic 验证失败。

**修复**:
1. `backend/app/models/unit.py`: `default=list` → `default=dict`
2. `backend/app/models/cadre.py`: 同上 (新数据预防)
3. `backend/app/schemas/unit.py`: 添加 `tags_list_to_dict` 验证器，兼容旧数据 `[]` → `{}`

### Bug 2: batch-delete 返回 405 Method Not Allowed
**根因**: `ids: List[UUID]` 被 FastAPI 解释为 query parameter 而非 request body，导致路由不匹配。

**修复**: `backend/app/api/v1/cadres.py`:
- 添加 `Body` import: `from fastapi import ...Body`
- 参数改为: `ids: List[UUID] = Body(...)`
- 注意: body 格式为纯数组 `["uuid1","uuid2"]`，非 `{"ids":[...]}`

## 修改的文件
1. `backend/app/models/unit.py` - tags default dict
2. `backend/app/models/cadre.py` - tags default dict
3. `backend/app/schemas/unit.py` - tags 验证器
4. `backend/app/api/v1/cadres.py` - batch-delete Body 参数
