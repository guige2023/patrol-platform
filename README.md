# 巡察工作管理平台 V3.1

基于 FastAPI + React 18 + TypeScript 的巡察工作管理系统。

## 技术栈

- **后端**: FastAPI 0.109 + SQLAlchemy 2.0 + PostgreSQL 16 + Alembic
- **前端**: React 18 + TypeScript + Vite 5 + Ant Design 5 + Zustand + React Query
- **部署**: Docker Compose

## 快速启动

```bash
# 克隆后直接启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

访问 http://localhost:3000

默认管理员账号: `admin` / `admin123`

## 项目结构

```
patrol_platform/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/   # API 路由 (15个模块)
│   │   ├── core/     # 安全核心 (JWT/加密/RBAC/审计)
│   │   ├── models/   # SQLAlchemy 模型 (16个)
│   │   ├── schemas/  # Pydantic Schemas
│   │   └── services/ # 业务服务层 + RuleEngine
│   └── alembic/      # 数据库迁移
├── frontend/          # React 前端
│   └── src/
│       ├── api/       # API 客户端
│       ├── components/# UI 组件
│       ├── pages/     # 页面
│       ├── store/     # Zustand 状态
│       └── hooks/     # 自定义 Hooks
└── docker-compose.yml
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
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev

# 数据库迁移
cd backend
alembic upgrade head
```

## API 文档

启动后访问 http://localhost:8000/docs (Swagger UI)

## License

MIT
