# 巡察工作管理平台 V3.2

基于 FastAPI + React 18 + TypeScript 的巡察工作管理系统。

## 技术栈

- **后端**: FastAPI 0.109 + SQLAlchemy 2.0 + SQLite（开发）/ PostgreSQL（生产）
- **前端**: React 18 + TypeScript + Vite 5 + Ant Design 5 + Zustand + React Query
- **部署**: Docker Compose（生产）/ 本地开发（开发）

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

访问 http://localhost:3000，默认账号: `admin` / `admin123`

### 生产模式（Docker）

```bash
docker-compose up -d
docker-compose logs -f
```

访问 http://localhost:3000

## 关键端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3000 | React 开发服务器 |
| 后端 | 18800 | FastAPI（Vite 代理 `/api` → 本端口） |
| Swagger | http://localhost:18800/docs | API 文档 |

> 注意：旧文档可能写 8000/18000，请以本文件为准。

## 项目结构

```
patrol_platform/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/   # API 路由（15个模块）
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

| 模块 | 说明 |
|------|------|
| 单位档案 | 树形结构单位管理 |
| 干部人才库 | 干部信息 + 回避检测 |
| 知识库 | 法规/制度/定性词典 |
| 巡察计划 | 多状态工作流 |
| 巡察组 | 成员分配 + 回避检测 |
| 底稿 | 多级审批流 |
| 线索 | 高密库 + 移交管理 |
| 整改 | 派单 + 进度 + 红黄灯预警 |

## 开发

```bash
# 数据库迁移
cd backend
alembic upgrade head
```

## API 文档

启动后端后访问 http://localhost:18800/docs（Swagger UI）

## License

MIT
