# 巡察工作管理平台 V3.2

基于 FastAPI + React 18 + TypeScript 的巡察工作管理系统。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite 5 + Ant Design 5 + Zustand + React Query |
| 后端 | FastAPI 0.109 + SQLAlchemy 2.0 + Pydantic |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） |
| 文件存储 | Local + StaticFiles + PyMuPDF 水印 |

## 快速启动

### 开发模式（本地）

```bash
# 后端
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 18800

# 前端（新终端）
cd frontend
npm install
npm run dev
```

访问 http://localhost:3070。首次初始化账号为 `admin`，密码使用 `ADMIN_PASSWORD`；如未设置，初始化脚本会生成随机密码并打印一次。

### 生产模式（Docker）

```bash
cp .env.example .env
# 编辑 .env，填入强密码和密钥
docker-compose up -d
docker-compose logs -f
```

访问 http://localhost:3000

## 关键端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端开发 | 3070 | React 开发服务器 |
| 前端生产 | 3000 | Docker/Nginx |
| 后端开发 | 18800 | FastAPI（Vite 代理 `/api` → 本端口） |
| 后端生产 | 8000 | Docker Compose 内后端服务 |
| Swagger | http://localhost:18800/docs | API 文档 |

> 注意：Docker 后端默认映射到 8000，本地开发命令使用 18800。

## 项目结构

```
patrol_platform/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/   # API 路由（20个模块）
│   │   ├── core/     # 安全核心（JWT/加密/RBAC/审计）
│   │   ├── models/   # SQLAlchemy 模型（16个）
│   │   ├── schemas/  # Pydantic Schemas
│   │   └── services/ # 业务服务层 + RuleEngine
│   ├── alembic/      # 数据库迁移
│   └── patrol.db     # SQLite 数据库（开发）
├── frontend/          # React 前端
│   └── src/
│       ├── api/       # API 客户端
│       ├── components/# UI 组件
│       ├── pages/     # 页面
│       ├── store/     # Zustand 状态
│       └── hooks/     # 自定义 Hooks
└── docker-compose.yml # 生产部署
```

## 核心功能模块

| 模块 | 说明 | 状态 |
|------|------|------|
| 单位档案 | 树形结构单位管理，支持业务标签分类 | ✅ |
| 干部人才库 | 干部信息 + 回避检测 + 分类管理 | ✅ |
| 知识库 | 法规/制度/定性词典，支持文件上传下载预览 | ✅ |
| 巡察计划 | 多状态工作流，支持分类单位独立周期配置 | ✅ |
| 巡察组 | 成员分配 + 回避检测 + 可配置匹配规则 | ✅ |
| 底稿 | 多级审批流 | ✅ |
| 线索 | 高密库 + 移交管理 | ✅ |
| 整改 | 派单 + 进度 + 红黄灯预警 | ✅ |
| 系统配置 | 巡察时间节点/匹配规则/预警规则/周期配置 | ✅ |
| 通知消息 | 系统通知管理 | ✅ |
| 系统告警 | 告警记录管理 | ✅ |
| 全局搜索 | 跨模块搜索 | ✅ |
| 仪表盘 | 数据统计和概览 | ✅ |
| 备份恢复 | 数据库备份和恢复 | ✅ |

## 数据模型关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        巡察计划 (Plan)                          │
│  id, name, year, round_name, target_units[], focus_areas[]      │
│  planned_start/end_date, actual_start/end_date                  │
│  status: draft→submitted→approved→published→in_progress→completed│
└─────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────────────────┐
         ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐
│    巡察组 (Group)   │      │   线索 (Clue)       │
│  id, name, plan_id  │      │  id, title, content │
│  leader_cadre_id    │      │  source, level      │
│  status: draft→...  │      │  status: ...       │
└─────────────────────┘      └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   底稿 (Draft)      │
│  id, group_id       │
│  focus_area, status │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐      ┌─────────────────────┐
│   进度 (Progress)   │      │ 整改(Rectification) │
│  id, plan_id        │      │  id, clue_id        │
│  unit_id, progress% │      │  target_unit_id     │
│  status             │      │  status: dispatched→│
└─────────────────────┘      │  progressing→...    │
                             └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│    干部 (Cadre)     │
│  id, name, unit_id  │
│  id_card, position  │
│  category           │
└─────────────────────┘
```

## 业务流程

### 1. 巡察计划流程

```
创建计划 → 选择单位 → 填写信息 → 匹配巡察组 → 提交审批
    ↓
审批流程: draft → submitted → approved → published
    ↓
执行监督: published → in_progress → completed
```

### 2. 整改跟踪流程

```
线索登记 → 关联整改 → 派发整改 → 整改进度 → 整改完成 → 提交审核 → 审核通过
```

## 状态流转

### 巡察计划状态

```
draft → submitted → approved → published → in_progress → completed
  │         │           │          │            │
  └─────────┴───────────┴──────────┴────────────┘
         (只有上一步完成才能进入下一步)
```

### 整改状态

```
dispatched → progressing → completed → submitted → verified
```

## 前端页面结构

```
├── 仪表盘 (Dashboard)
├── 全局搜索 (/search)
│
├── 档案管理
│   ├── 单位列表 (/archive/units)
│   ├── 干部列表 (/archive/cadres) - 导入/导出
│   └── 知识库 (/archive/knowledge) - 附件上传/下载/预览
│
├── 巡察计划 (/plans)
│   └── 巡察组 (/groups)
│
├── 执行管理
│   ├── 底稿管理 (/execution/drafts)
│   ├── 线索管理 (/execution/clues)
│   ├── 整改管理 (/execution/rectifications)
│   └── 进度管理 (/execution/progress)
│
├── 文档管理 (/documents)
│
└── 系统管理
    ├── 用户管理 (/admin/users)
    ├── 审计日志 (/admin/audit-logs)
    ├── 角色管理 (/admin/roles)
    ├── 模块配置 (/admin/modules)
    ├── 字段配置 (/admin/field-options)
    ├── 系统配置 (/admin/system-configs)
    ├── 备份恢复 (/admin/backup)
    ├── 通知管理 (/admin/notifications)
    └── 告警管理 (/admin/alerts)
```

## 后端 API 结构

| 路由前缀 | 功能 | 权限 |
|----------|------|------|
| `/auth` | 认证 | 公开 |
| `/units` | 单位档案 | `unit:*` |
| `/cadres` | 干部人才 | `cadre:*` |
| `/knowledge` | 知识库 | `knowledge:*` |
| `/knowledge-files` | 知识库附件 | `attachment:*` |
| `/plans` | 巡察计划 | `plan:*` |
| `/groups` | 巡察组 | `group:*` |
| `/drafts` | 底稿 | `draft:*` |
| `/clues` | 线索 | `clue:*` |
| `/rectifications` | 整改 | `rectification:*` |
| `/progress` | 进度 | `progress:*` |
| `/documents` | 公文 | `document:*` |
| `/admin/users` | 用户管理 | `user:*` |
| `/admin/roles` | 角色管理 | `role:*` |
| `/admin/audit-logs` | 审计日志 | `audit:*` |
| `/admin/modules` | 模块管理 | `admin:*` |
| `/admin/field-options` | 字段配置 | `field_option:*` |
| `/admin/system-configs` | 系统配置 | `system_config:*` |
| `/admin/backup` | 备份恢复 | `backup:*` |
| `/admin/notifications` | 通知管理 | 认证 |
| `/admin/alerts` | 告警管理 | 认证 |
| `/dashboard` | 看板统计 | 认证 |
| `/search` | 全局搜索 | 认证 |

## 权限体系

| 权限 | 说明 |
|------|------|
| `user:*` | 用户管理 |
| `role:*` | 角色管理 |
| `plan:*` | 巡察计划 |
| `group:*` | 巡察组 |
| `cadre:*` | 干部人才 |
| `unit:*` | 单位档案 |
| `knowledge:*` | 知识库 |
| `attachment:*` | 附件管理 |
| `clue:*` | 线索管理 |
| `rectification:*` | 整改管理 |
| `draft:*` | 底稿管理 |
| `progress:*` | 进度管理 |
| `document:*` | 公文管理 |
| `backup:*` | 备份管理 |
| `system_config:*` | 系统配置 |
| `field_option:*` | 字段配置 |
| `audit:*` | 审计日志 |

## 系统配置说明

系统配置分为四个标签页：

### 1. 巡察时间节点

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 常规巡察天数 | 常规巡察计划持续天数 | 30 |
| 专项巡察天数 | 专项巡察计划持续天数 | 15 |
| 巡驻时间最小/最大周数 | 巡察组驻点时间范围 | 4-8周 |
| 中期汇报周数 | 中期汇报节点 | 4周 |
| 整改期限最小/最大月数 | 整改期限范围 | 1-3月 |
| 回头看最小/最大月数 | 回头看期限范围 | 3-6月 |

### 2. 巡察组匹配规则

| 配置项 | 说明 |
|--------|------|
| 组长最低职级 | 巡察组长的最低职级要求 |
| 禁止同单位人员同组 | 是否禁止同一单位人员编入同一巡察组 |
| 禁止上级/下级单位人员同组 | 层级回避规则 |
| 按标签匹配 | 是否启用按单位业务标签匹配干部 |
| 标签匹配规则 | JSON格式：单位业务标签 → 匹配干部类别 |
| 默认干部类别 | 标签未匹配时使用的默认干部类别 |
| 巡察组最大/最小人数 | 巡察组成员数限制 |

**标签匹配规则示例：**
```json
{
  "财务": ["财务干部"],
  "审计": ["审计干部"],
  "纪检监察": ["纪检监察干部"],
  "党建": ["综合干部"],
  "组织": ["综合干部"]
}
```

### 3. 预警规则

| 配置项 | 说明 |
|--------|------|
| 待整改预警 | 整改任务待开始时触发预警 |
| 整改中预警 | 整改进行中时触发预警 |
| 已逾期预警 | 整改任务已超期触发预警 |
| 未巡察单位预警 | 单位超出巡察周期未巡察时触发预警 |
| 未巡察预警年限 | 单位多久未巡察触发预警 |
| 提前预警天数 | 提前多少天发送预警 |

### 4. 巡察周期配置

按单位类型分两类独立配置：

**管委会/政府部门：**

| 配置项 | 说明 |
|--------|------|
| 每轮全覆盖开始时间 | 巡察周期起始年份 |
| 每轮全覆盖年份数 | 一个巡察周期的年数 |

**其他单位：**

| 配置项 | 说明 |
|--------|------|
| 每轮全覆盖开始时间 | 巡察周期起始年份 |
| 每轮全覆盖年份数 | 一个巡察周期的年数 |

## 单位业务标签

单位档案新增"业务标签"字段，用于：
1. 标识单位业务类型（财务、审计、纪检监察等）
2. 配合系统配置的"标签匹配规则"自动匹配巡察组成员
3. 分类统计和管理

## 开发

```bash
# 数据库迁移
cd backend
alembic upgrade head
```

运行时上传、备份和生成文档默认写入 `runtime/`，不会进入版本控制。

## API 文档

启动后端后访问 http://localhost:18800/docs（Swagger UI）

## License

MIT
