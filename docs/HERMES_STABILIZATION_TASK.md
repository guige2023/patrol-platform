# Hermes 后续整改任务：把巡察平台整理成完整稳定可用版本

## 背景

项目路径：`/Users/guige/my_project/patrol_platform`

当前状态：已经完成第一轮安全与仓库清理，包括移除 Git 跟踪中的运行时上传/备份/导出文件、移除默认固定密码、去掉登录密码泄露、去掉 JWT 敏感日志、将硬编码路径改为环境变量、补充基础 lint/test 配置。

原始完整备份：`/Users/guige/patrol_platform_backup_20260428_204814`

重要约束：

- 不要删除或覆盖备份目录。
- 不要恢复已从 Git 中移除的上传文件、备份 zip、导出文档。
- 不要重新引入默认弱密码，例如 `admin123`、`patrol123`、`minioadmin123`。
- 不要把 `.env`、数据库文件、上传文件、备份文件提交进 Git。
- 不要使用 `git reset --hard` 或大范围回退。

## 总目标

交付一个完整、稳定、可用、可部署的巡察工作管理平台：

- 本地开发能按 README 一步步启动。
- Docker Compose 能用 `.env` 启动完整服务。
- 登录、单位、干部、知识库、计划、巡察组、底稿、线索、整改、文档、备份、搜索等核心功能可用。
- 构建、lint、测试能稳定运行。
- 上传、备份、导出文档等运行时文件不污染仓库。
- 安全边界合理：无默认弱口令、无敏感日志、文件访问走鉴权接口。

## 当前已知验证结果

已通过：

- `cd frontend && npm run build`
- `cd frontend && npm run lint`，当前只有 warning
- `cd backend && pytest`，当前结果为 `19 passed, 3 skipped`
- `python3 -m py_compile ...` 对已修改后端文件通过

仍存在的风险：

- 前端主包约 `2.76MB`，需要拆包优化。
- 前端 `any` 很多，lint warning 约 284 个。
- 当前全局环境缺 `pytest-asyncio`，异步 API 测试被跳过。
- Alembic 没有 migration version，数据库演进不可控。
- 业务接口多数只有登录认证，缺少模块级权限控制。
- Git 历史中可能仍有历史敏感文件，如要发布到外部，需要清理历史。

## 第一阶段：建立可复现运行环境

任务：

1. 创建清晰的本地启动流程。
2. 确认后端依赖完整，尤其是 `meilisearch`、`pytest-asyncio`。
3. 确认前端 Node/npm 版本要求。
4. 修正 README 中所有端口、环境变量、初始化数据库、创建管理员、启动前后端步骤。
5. 提供 `.env.example` 的完整说明。

验收标准：

- 新机器按 README 能完成依赖安装、初始化数据库、启动后端、启动前端。
- `ADMIN_PASSWORD` 不设置时会生成随机密码；设置时使用指定密码。
- 不需要依赖 `/Users/guige/...` 这类本机绝对路径。

建议命令：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ADMIN_PASSWORD='change-me-local' python scripts/init_db.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 18800
```

```bash
cd frontend
npm install
npm run dev
```

## 第二阶段：数据库与迁移体系

任务：

1. 检查所有 SQLAlchemy model 与实际初始化流程。
2. 建立 Alembic baseline migration。
3. 确保 `alembic upgrade head` 能创建完整 schema。
4. 避免继续依赖 `Base.metadata.create_all` 作为生产初始化方式。
5. 修复 `alembic.ini` 中硬编码数据库地址，改用环境变量或 `app.config.settings`。

验收标准：

- `backend/alembic/versions/` 至少有一个 baseline migration。
- 空数据库执行 `alembic upgrade head` 成功。
- 执行 `python scripts/init_db.py` 后有管理员、默认角色、默认系统配置。
- README 明确开发和生产的迁移步骤。

## 第三阶段：后端安全与权限

任务：

1. 梳理所有 `backend/app/api/v1/*.py` 路由。
2. 给核心业务接口补模块级权限检查。
3. 管理员接口、备份恢复、系统配置、用户/角色管理必须强权限。
4. 文件预览/下载必须通过鉴权接口，不允许默认静态公开 `/uploads`。
5. 登录接口增加基础安全策略：错误信息统一、可选登录失败限速、密码复杂度校验。
6. 审计日志覆盖关键写操作：创建、修改、删除、审批、恢复备份、导出/下载敏感文件。

验收标准：

- 普通用户不能访问管理、备份、系统配置、角色权限接口。
- 未登录访问业务接口返回 401/403。
- 上传文件不能通过裸 `/uploads/...` 直接访问，除非显式设置 `SERVE_UPLOADS=true` 且文档说明风险。
- 日志中不出现 token、密码、JWT payload、完整身份证等敏感数据。

## 第四阶段：文件、备份、文档模块稳定化

任务：

1. 统一运行时目录：上传、备份、文档全部走 `runtime/` 或环境变量。
2. 检查知识库附件上传、预览、下载、水印、Office 转 PDF。
3. 检查公文生成、下载、预览。
4. 检查备份创建、下载、删除、恢复。
5. 恢复功能必须增加二次确认和权限控制。
6. 文件名处理必须防路径穿越和异常字符问题。
7. 大文件上传要有大小限制。

验收标准：

- 上传 PDF/图片/Office 文件后可预览和下载。
- 未授权用户不能访问附件。
- 备份文件生成在运行时目录，不进入 Git。
- 恢复失败时返回明确错误，不吞异常。
- 文件名含中文、空格、特殊字符时功能正常。

## 第五阶段：前端稳定性与可用性

任务：

1. 解决登录、退出、刷新后认证恢复流程。
2. 删除所有密码 URL 自动登录逻辑，不再支持 `?p=...`。
3. 统一 API 错误处理，避免重复弹错。
4. 给主要页面补 loading、empty、error 状态。
5. 整理 API 类型，逐步减少 `any`。
6. 检查所有 CRUD 弹窗关闭、表单重置、分页刷新逻辑。
7. 修复当前 lint warning 中的真实问题，例如空 catch、非空断言、奇怪空白字符。

验收标准：

- `npm run build` 通过。
- `npm run lint` 通过，warning 数明显下降，目标低于 50。
- 主要业务流程人工验收通过：登录、单位管理、干部管理、知识库上传下载、计划创建、巡察组创建、底稿、线索、整改、备份。

## 第六阶段：前端性能优化

任务：

1. 按路由拆分页面组件，使用 `React.lazy` 或等价方案。
2. 拆分大型依赖：Ant Design、ECharts、TinyMCE。
3. 移除无效动态 import，当前 Vite 已提示动态导入被静态导入抵消。
4. 配置合理的 `manualChunks`。
5. 检查未使用依赖和重复依赖。

验收标准：

- 首包 JS 从约 `2.76MB` 降到合理范围，目标低于 `1MB` minified。
- 构建不再出现主要 chunk 过大警告，或者有明确说明和阈值配置。
- 页面切换无明显白屏或异常。

## 第七阶段：测试与 CI

任务：

1. 安装并固定 `pytest-asyncio`，恢复异步 API 测试。
2. 让 API 测试不依赖真实管理员密码或真实生产库，改用测试数据库和依赖覆盖。
3. 为关键接口补测试：认证、权限、文件、备份、计划、巡察组、整改。
4. 前端至少补 smoke test 或 Playwright 登录流。
5. 配置 GitHub Actions 或本地 `scripts/check.sh`。

验收标准：

- `cd backend && pytest` 不跳过核心 API 测试。
- `cd frontend && npm run build && npm run lint` 稳定通过。
- 一条命令能跑完整质量检查。

建议新增：

```bash
scripts/check.sh
```

内容至少包括：

```bash
cd backend && pytest
cd ../frontend && npm run lint && npm run build
```

## 第八阶段：Docker Compose 生产可用

任务：

1. 用 `.env.example` 复制 `.env` 后启动 Compose。
2. 确认 Postgres、MinIO、Meilisearch、backend、frontend 联通。
3. 后端容器启动前执行迁移或提供明确迁移命令。
4. 运行时目录使用 Docker volume。
5. 健康检查覆盖 backend、db、meilisearch。
6. 不在 compose 中暴露不必要端口，MinIO console 等端口按需暴露。

验收标准：

- `cp .env.example .env` 并填强密码后，`docker-compose up -d --build` 成功。
- 打开 `http://localhost:3000` 能登录。
- 后端 `http://localhost:8000/health` 返回 ok。
- 上传、搜索、备份功能在容器环境可用。

## 第九阶段：Git 历史和发布安全

任务：

1. 如果仓库要对外发布，使用 `git filter-repo` 或 BFG 清理历史中的上传、备份、导出文件。
2. 检查历史中是否出现真实密码、token、个人信息文件。
3. 旋转所有曾经提交过或日志里出现过的密钥和密码。
4. 写清楚“清理历史会重写 Git 历史，需要团队确认”。

验收标准：

- 当前 HEAD 和历史都不包含敏感运行时文件。
- 所有生产密钥都已更换。
- 团队成员重新 clone 或按重写历史流程同步。

## 推荐执行顺序

1. 先做第一阶段和第二阶段，保证环境与数据库可复现。
2. 再做第三阶段和第四阶段，补安全边界和文件稳定性。
3. 然后做第五阶段和第六阶段，提升前端可用性和性能。
4. 最后做第七阶段到第九阶段，补测试、部署和发布安全。

## 每次修改后的固定检查

每轮提交前执行：

```bash
cd backend
python3 -m py_compile app/config.py app/main.py app/dependencies.py
pytest
```

```bash
cd frontend
npm run lint
npm run build
```

再检查敏感内容：

```bash
rg -n "admin123|patrol123|minioadmin123|Token received|Payload|console\\.log|/Users/guige|allow_origins=\\[\\\"\\*\\\"\\]" backend frontend README.md docker-compose.yml
git ls-files backend/uploads backend/backend/uploads backend/app/backups backend/app/static/documents
```

期望：

- 第一条命令没有敏感命中，除非是文档中解释历史问题。
- 第二条命令没有输出。

## 完成定义

可以认为项目达到“完整稳定可用”的条件：

- 本地开发环境可复现启动。
- Docker Compose 可一键启动核心服务。
- 首次初始化有安全管理员密码流程。
- 核心业务功能人工验收通过。
- 构建、lint、测试稳定通过。
- 运行时文件不进入 Git。
- 关键接口有权限控制和审计日志。
- README 与实际行为一致。
