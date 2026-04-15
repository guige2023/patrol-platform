# 巡察工作管理平台 — 桌面端离线部署方案

## 目标

将现有巡察工作管理平台（FastAPI + React）改造为**桌面端离线应用**，
部署在政府内网单台服务器上，其他科室电脑通过局域网浏览器访问。

## 部署拓扑

```
一台服务器（物理机/虚拟机）
├── FastAPI 后端（0.0.0.0:18800，全接口暴露）
├── SQLite 数据库（本地文件，无外部依赖）
├── Electron 桌面壳（启动后端 + 显示前端）
└── 其他科室电脑 → 浏览器访问 http://服务器IP:18800
```

## 核心方案：PyInstaller 打包 FastAPI + Electron 前端壳

### 为什么用这个方案

| 方案 | 离线可用 | 改后端 | 改前端 | 打包体积 | 难度 |
|------|---------|--------|--------|---------|------|
| Electron（当前 Web 端不动）| ✅ | 0 | 0 | ~300MB | 低 |
| Tauri（需重写后端）| ✅ | **全部重写** | 0 | ~20MB | **极高** |
| PyInstaller 纯后端 + 浏览器 | ✅ | 0 | 0 | ~200MB | 低 |
| Docker 镜像 | ❌ 需要 Docker | 0 | 0 | ~1GB | 中 |

**最终选择：PyInstaller 打包 FastAPI 后端（含 SQLite）+ Electron 前端壳**

- FastAPI 后端：PyInstaller 打包成单个 `patrol_backend.exe`，前端 React 构建产物直接嵌入后端二进制（`/static` 静态文件服务）
- Electron：仅用作桌面窗口管理（启动后端进程、显示前端、托盘、菜单），非常轻量
- 数据库：SQLite（无服务器依赖，文件即数据库）
- 授权：内网部署无用户数限制

---

## 实施步骤

### Phase 1：后端改造（3-4 小时）

**目标**：FastAPI 后端不依赖任何外部环境（Python、Node.js），打包成独立可执行文件。

#### Step 1.1：后端添加静态文件服务

修改 `backend/app/main.py`，在 FastAPI 中挂载前端构建产物作为静态文件：

```python
# main.py 新增
from fastapi.staticfiles import StaticFiles
import os

frontend_dist = os.path.join(os.path.dirname(__file__), "../../frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
```

这样 `patrol_backend.exe` 启动后：
- API 路由：`/api/v1/*`
- 前端页面：`/*`（所有非 API 路径返回 `index.html`，支持 SPA 路由）

#### Step 1.2：后端配置允许跨域和局域网访问

```python
# main.py CORS 配置保持 allow_origins=["*"]（内网无安全问题）
# 后端监听 0.0.0.0:18800（而非 127.0.0.1），允许局域网访问
```

#### Step 1.3：后端启动脚本（entry point）

创建 `backend/start.py` 作为 PyInstaller 入口：

```python
# backend/start.py
import uvicorn, sys, os

# 数据库文件放在用户数据目录（而非代码目录，打包后不可写）
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "patrol.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=18800,
        reload=False,
        log_level="info"
    )
```

#### Step 1.4：PyInstaller 打包配置

创建 `backend/spec/patrol_backend.spec`：

```python
# patrol_backend.spec
a = Analysis(
    ['start.py'],
    hiddenimports=[
        'uvicorn', 'uvicorn.loops', 'uvicorn.loops.auto',
        'fastapi', 'pydantic', 'sqlalchemy.ext.asyncio',
        'apscheduler', 'openpyxl', 'bcrypt', 'python_jose',
        'passlib', 'python-multipart', 'email_validator',
    ],
    ...
)
pyz = PYZ(a.pure)
exe = EXE(pyz, ...)
```

#### Step 1.5：测试打包后的后端

```bash
cd backend
pyinstaller patrol_backend.spec --clean
./dist/patrol_backend/start.exe  # 或在 Mac 上 ./dist/patrol_backend/start.app
# 测试：curl http://127.0.0.1:18800/api/v1/auth/login -X POST
```

**验证**：
- [ ] `GET http://127.0.0.1:18800/health` 返回 `{"status": "ok"}`
- [ ] `GET http://127.0.0.1:18800/` 返回前端 `index.html`
- [ ] `POST /api/v1/auth/login` 正常
- [ ] `GET /api/v1/plans/` 正常返回数据

---

### Phase 2：Electron 前端壳（2-3 小时）

**目标**：用 Electron 包装后端启动 + 前端显示，做成用户可双击打开的应用。

#### Step 2.1：创建 Electron 项目结构

```
patrol-platform-desktop/
├── main/
│   ├── main.ts              # Electron 主进程
│   ├── preload.ts            # contextBridge 安全桥接
│   └── backend-starter.ts    # 启动后端子进程
├── package.json
├── electron-builder.yml
└── vite.config.ts
```

#### Step 2.2：Electron 主进程逻辑（main.ts）

核心职责：
1. 启动时检查后端是否已运行（`GET http://127.0.0.1:18800/health`）
2. 如果未运行，从资源目录启动 `patrol_backend.exe`（打包后的后端可执行文件）
3. 等待后端就绪（健康检查轮询，最多 30 秒）
4. 打开 `http://127.0.0.1:18800` 的 `BrowserWindow`
5. 支持系统托盘（最小化到托盘，而非退出）
6. 应用菜单（文件、编辑、视图、帮助）

```typescript
// main.ts 伪代码
const BACKEND_PORT = 18800;
const MAIN_URL = `http://127.0.0.1:${BACKEND_PORT}`;

async function ensureBackend() {
  try {
    await fetch(`${MAIN_URL}/health`);
    return; // 后端已运行
  } catch {
    // 启动后端进程
    const exePath = path.join(process.resourcesPath, 'patrol_backend', 'start.exe');
    const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
  }
  // 等待后端就绪
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try { await fetch(`${MAIN_URL}/health`); return; } catch {}
  }
  throw new Error('后端启动超时');
}
```

#### Step 2.3：Electron 构建配置（electron-builder.yml）

```yaml
appId: com.patrol.platform
productName: 巡察工作管理平台
directories:
  output: dist-desktop
files:
  - dist/**/*
  - backend-dist/**/*
extraResources:
  - from: backend-dist/patrol_backend/
    to: patrol_backend/
    filter:
      - "**/*"
win:
  target: nsis
  icon: assets/icon.ico
mac:
  target: dmg
  icon: assets/icon.icns
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

#### Step 2.4：构建和测试

```bash
# 构建前端
cd frontend && npm run build

# 构建后端 PyInstaller 包
cd backend && pyinstaller patrol_backend.spec --clean

# 构建 Electron
cd patrol-platform-desktop && npm run build

# 输出
# Windows: dist-desktop/巡察工作管理平台Setup.exe
# Mac: dist-desktop/巡察工作管理平台.dmg
```

**验证**：
- [ ] 双击安装程序，桌面出现"巡察工作管理平台"图标
- [ ] 打开应用，后端自动启动（无命令行窗口）
- [ ] 应用窗口显示登录页面
- [ ] 登录后正常显示巡察计划列表
- [ ] 系统托盘图标存在，最小化到托盘正常
- [ ] 关闭主窗口 → 应用退出（托盘图标消失）
- [ ] 其他电脑浏览器访问 `http://服务器IP:18800` 正常显示

---

### Phase 3：局域网访问配置（1 小时）

#### Step 3.1：后端监听所有网络接口

`uvicorn.run(host="0.0.0.0", port=18800)` — 已包含在 Step 1.3

#### Step 3.2：启动时显示访问地址

Electron 主进程在应用启动成功后，显示局域网访问地址：

```typescript
// 在 BrowserWindow 的 ready-to-show 事件中
const localIP = await getLocalIP(); // e.g. 192.168.1.100
dialog.showMessageBox({
  title: '巡察工作管理平台',
  message: `本机访问：http://localhost:18800\n局域网访问：http://${localIP}:18800`,
});
```

#### Step 3.3：Windows 防火墙放行（可选）

用户手动操作，或安装程序自动添加防火墙规则（electron-builder 支持）。

---

### Phase 4：数据迁移和初始化（1 小时）

#### Step 4.1：数据库初始化

打包时附赠初始数据库 `patrol_empty.db`（空结构，无数据），首次启动时自动复制为 `patrol.db`。

#### Step 4.2：数据备份和恢复

在应用内增加"数据备份"功能（导出 `patrol.db` 文件）和"数据恢复"功能（导入备份文件）。

---

## 文件变更清单

### 新增文件

```
patrol_platform/
├── backend/start.py                      # PyInstaller 入口
├── backend/patrol_backend.spec           # PyInstaller spec 文件
├── frontend/dist/                        # npm run build 产物（.gitignore）
└── patrol-platform-desktop/              # Electron 项目（新建）
    ├── main/
    │   ├── main.ts
    │   ├── preload.ts
    │   └── backend-starter.ts
    ├── package.json
    ├── electron-builder.yml
    ├── tsconfig.json
    ├── vite.config.ts
    └── assets/
        ├── icon.ico
        └── icon.icns
```

### 修改文件

```
patrol_platform/
├── backend/app/main.py                   # 挂载前端静态文件 + 保持 CORS
├── backend/app/config.py                 # 数据库路径改为用户数据目录
├── backend/app/api/v1/plans.py           # 无改动（已支持）
├── backend/app/models/plan.py            # 无改动
└── frontend/vite.config.ts               # build outDir 改为 backend/app/static
```

---

## 工作量和时间估算

| Phase | 内容 | 预计时间 |
|-------|------|---------|
| Phase 1 | 后端改造 + PyInstaller 打包 | 3-4 小时 |
| Phase 2 | Electron 桌面壳 | 2-3 小时 |
| Phase 3 | 局域网访问配置 | 1 小时 |
| Phase 4 | 数据迁移和初始化 | 1 小时 |
| **合计** | | **7-10 小时** |

---

## 潜在风险和备选方案

### 风险 1：PyInstaller 打包体积大（~500MB）

**缓解**：使用 `--svelte` 压缩模式，剔除调试符号，预期 200-300MB。

**备选**：改用 `pyoxidizer`（Rust 打包 Python），体积可缩至 50MB，但配置复杂。

### 风险 2：SQLite 并发写入（多用户同时操作）

**分析**：SQLite 写锁是数据库级别的，高并发写入会排队。对于政府内网科室使用（通常 < 20 人同时在线），这是可接受的范围。

**备选**：如果未来需要更高并发，可切换为 PostgreSQL（用户自行安装 Docker 或直接装 PostgreSQL）。

### 风险 3：局域网 HTTPS 访问

**说明**：内网部署通常用 HTTP，无需 HTTPS。如果未来需要，可给后端加自签名证书。

### 风险 4：跨域问题

**现状**：CORS 配置 `allow_origins=["*"]` 已允许所有来源访问。局域网浏览器访问后端 API 无跨域限制。

---

## 开放问题

1. **是否需要用户管理系统？** 现有系统已有 RBAC 用户/角色，但登录是单机的（无外部 IdP）。是否需要增加"单位/部门"概念的多租户支持？
2. **数据是否需要加密存储？** SQLite 文件无加密，政府客户是否有等保要求？
3. **安装包是否需要支持自动更新？** Electron + electron-builder 支持 S3/GitHub releases 自动更新。
4. **是否需要打印功能？** 巡察报告、整改通知书等是否需要本地打印支持？
5. **一台服务器同时支持多少并发用户？** 建议不超过 50 人（SQLite 写并发限制）。
