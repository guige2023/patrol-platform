# 巡察工作管理平台 — 桌面端离线部署方案（定稿版）

## 目标

将现有巡察工作管理平台改造为**桌面端离线应用**，部署在政府内网单台服务器上，
其他科室电脑通过局域网浏览器访问。完全离线、内网部署、无外部依赖。

## 最终交付物

- Windows：一键安装程序 `巡察工作管理平台Setup.exe`
- Mac：DMG 安装包
- 双击安装 → 自动启动后端 + 打开应用窗口
- 其他科室电脑浏览器 `http://服务器IP:18800` 即可使用

---

## 部署拓扑

```
┌─────────────────────────────────────────────────┐
│  政府内网服务器（单机部署）                        │
│  ┌──────────────────────────────────────────┐  │
│  │  巡察工作管理平台                            │  │
│  │  ├── FastAPI 后端（0.0.0.0:18800）         │  │
│  │  ├── SQLite 数据库（SQLCipher 加密）        │  │
│  │  └── Electron 窗口（前端 React）            │  │
│  └──────────────────────────────────────────┘  │
│  局域网：http://192.168.1.x:18800（所有路径）     │
└─────────────────────────────────────────────────┘
           ▲
           │  局域网 HTTP 访问（多用户）
           │
  ┌──────────────────────────────────────────┐
  │  科室电脑 A → 浏览器登录账户 A               │
  │  科室电脑 B → 浏览器登录账户 B               │
  │  科室电脑 C → 浏览器登录账户 C               │
  └──────────────────────────────────────────┘
```

---

## 用户确认需求汇总

| 需求 | 确认 |
|------|------|
| 多账户独立登录，平等权限（无审批/层级） | ✅ |
| SQLite 数据库加密存储 | ✅ |
| 巡察报告、整改通知书本地打印 | ✅ |
| Excel 批量导入（计划/干部/单位） | ✅ |
| 操作日志（审计）| ✅ |
| 无自动更新推送 | ✅ |

---

## Phase 0：功能简化（先做）

**目标**：砍掉审批流程 + 清理 RBAC，保留审计日志。

### Step 0.1：简化状态机

删除所有"提交/审批/发布"步骤，简化为两态：

| 模块 | 旧状态 | 新状态 |
|------|--------|--------|
| 巡察计划 | draft → submitted → approved → published → in_progress → completed | **草稿 ↔ 正式** |
| 巡察组 | draft → submitted → approved | **草稿 ↔ 正式** |
| 整改 | rectifying → submitted → verified | **整改中 ↔ 已完成** |
| 巡察底稿 | 无状态流程 | 无变化 |

**前端改动**：
- `PlanList.tsx`：删除"提交审批/批准/发布"按钮；只剩"编辑/删除"；加一个"启用/停用"切换开关
- `PlanDetail.tsx`：删除"提交审批"按钮；状态字段改为简单开关
- `GroupList.tsx`：同上
- `GroupDetail.tsx`：同上
- `RectificationList.tsx`：删除"提交验收"按钮；只剩"编辑/删除"和"完成"按钮
- 各列表的 `status` 筛选器：只保留相关两态选项

**后端改动**：
- `plans.py`：`POST /plans/{id}/status`（Phase 3 加的）→ 改为 `PATCH /plans/{id}` 直接更新 `is_active` 字段，不再走发布流程
- `groups.py`：同上逻辑
- `rectifications.py`：删除 `submit/` 端点；`status` 字段简化为 `rectifying` / `completed`

### Step 0.2：砍掉 RBAC 复杂权限

**删除内容**：
- 用户管理页面（`Admin/Users/`）：保留，但只有 admin 自己可以改密码
- 角色管理页面（`Admin/Roles/`）：删除，合并为简单"账户管理"
- 权限管理（`Admin/Modules/`）：删除
- `Admin/Audit/` 审计日志：保留（**用户要求保留**）
- `rbac.py` 装饰器：`require_permissions` 相关代码保留但不再使用
- `dependencies.py`：`get_current_user` 保留（登录认证用），但去掉权限层级判断

**保留内容**：
- 用户登录认证（JWT）
- 每个账户独立操作（审计日志记"谁干了什么"）
- 审计日志：谁在什么时间改了什么（**保留**）

**数据模型**：
- `User` 表：保留 `id/username/password`，删除 `role/permissions` 列
- `AuditLog` 表：保留（记录 `user_id/action/entity_type/entity_id/details/timestamp`）

### Step 0.3：前端简化

- 删除 `Admin/Users/` 里的"新增用户/删除用户"功能 → 只保留 admin 自己改密码
- 删除 `Admin/Roles/` 整个页面
- 删除 `Admin/Modules/` 整个页面
- 删除 `Admin/Audit/` 里的"角色变更/权限变更"过滤条件（已无意义）
- 删除顶部导航栏里的"系统管理"下的角色/权限子菜单

---

## Phase 1：数据库加密（SQLCipher）（4-5 小时）

**目标**：SQLite 数据库文件加密存储，即使硬盘被拿走也无法读取数据。

### 方案选择：SQLCipher

使用 `SQLCipher`（OpenSSL 扩展的 SQLite），通过 `pysqlcipher3` Python 绑定。

**优点**：
- 数据库文件完全加密（.db 文件本身是密文）
- 加密密钥由用户设置，不存储在代码里
- 与 SQLAlchemy 无缝集成（换驱动 + 加参数）
- 符合政府等保要求

### Step 1.1：后端依赖变更

```bash
# backend/requirements.txt
# 删除: sqlalchemy[asyncio]
# 新增: sqlalchemy[asyncio] pysqlcipher3
```

```txt
# requirements.txt
fastapi>=0.100.0
uvicorn[standard]>=0.23.0
pysqlcipher3>=1.0.4
sqlalchemy[asyncio]>=2.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6
openpyxl>=3.1.0
aiofiles>=23.0.0
apscheduler>=3.10.0
email-validator>=2.0.0
```

### Step 1.2：数据库连接配置

```python
# backend/app/config.py 新增
@dataclass
class Settings:
    # 数据库
    DATABASE_URL: str = "sqlite+pysqlcipher:///:memory:"
    DB_PASSWORD: str = "patrol_secret_key_2024"  # 用户首次启动时设置

# 连接字符串格式
# sqlite+pysqlcipher3:///path/to/patrol.db?cipher=aes-256-cbc&kdf_iter=256000
```

### Step 1.3：首次启动密码设置

桌面应用首次启动时，弹出窗口让用户设置数据库密码：

```
┌────────────────────────────────────────┐
│  巡察工作管理平台 — 初始化设置           │
│                                        │
│  请设置数据库密码（不少于 8 位）：       │
│  [________________________]            │
│                                        │
│  确认密码：                            │
│  [________________________]            │
│                                        │
│  ⚠️  忘记密码将无法恢复数据             │
│      请妥善保管！                        │
│                                        │
│         [ 确认 ]  [ 取消 ]              │
└────────────────────────────────────────┘
```

**实现方式**：
- 首次启动检测 `patrol.db` 不存在 → Electron 弹出初始化对话框
- 用户输入密码 → 写入本地配置文件 `~/.patrol-platform/config.json`（包含加密后的密码 hash）
- 实际加密密钥 = 用户密码的 PBKDF2 派生值（永不存储明文）
- 后端启动时读取配置文件获取密钥，启动 SQLCipher 连接

### Step 1.4：密码重置（灾难恢复）

提供命令行工具 `reset_db.py`，用旧密码导出数据，然后重新初始化：

```bash
python reset_db.py --old-password=xxx --new-password=yyy
# 导出旧数据 → 创建新加密数据库 → 导入数据
```

### Step 1.5：验证

```bash
# 无密码直接打开 db 文件 → 乱码
sqlite3 patrol.db "SELECT * FROM users;"
# → file is encrypted or not a database

# 用密码打开 → 正常
sqlite3 patrol.db "PRAGMA key='your_password'; SELECT * FROM users;"
```

---

## Phase 2：Excel 批量导入（6-8 小时）

**目标**：支持 Excel 文件批量导入巡察计划、干部信息、单位信息。

### Step 2.1：干部批量导入

**模板格式**（Excel）：

| 姓名 | 性别 | 出生年月 | 民族 | 学历 | 政治面貌 | 工作单位 | 职务 | 职级 | 入编时间 | 联系方式 |
|------|------|---------|------|------|---------|---------|------|------|---------|---------|
| 张三 | 男 | 1985-03 | 汉 | 本科 | 中共党员 | 县财政局 | 科员 | 副科 | 2010-07 | 138xxx |

**导入流程**：
1. 前端 `CadreImportModal.tsx`：上传 Excel → 解析 → 显示预览表格 → 用户确认 → `POST /cadres/import`
2. 后端 `cadres.py` 新增 `POST /cadres/import`：
   - `openpyxl` 解析 Excel
   - 逐行校验（必填字段、日期格式、性别枚举）
   - 错误行跳过并返回错误报告（"第3行：姓名必填"）
   - 正确行批量插入
   - 返回成功数/失败数/错误明细

**校验规则**：
- 姓名：必填，2-50字符
- 性别：男/女
- 出生年月：YYYY-MM-DD 格式
- 民族：汉族/回族/...（调用 field-options）
- 学历：中专/高中/大专/本科/硕士/博士
- 政治面貌：群众/中共党员/共青团员/...
- 职级：科员/副科/正科/副处/正处/...
- 工作单位：必须是已存在的单位（UUID 匹配）

### Step 2.2：单位批量导入

**模板格式**（Excel）：

| 单位全称 | 单位简称 | 上级单位 | 类型 | 联系电话 | 地址 |
|---------|---------|---------|------|---------|------|
| 县财政局 | 财政局 | 县政府办 | 党政机关 | 055x-xxxx | 县城xx路 |

**导入流程**：同上

### Step 2.3：巡察计划批量导入

**模板格式**（Excel）：

| 计划名称 | 年份 | 巡察轮次 | 巡察单位 | 巡察时间 | 巡察组名称 |
|---------|------|---------|---------|---------|---------|

**限制**：计划导入需要先存在对应的"单位"和"巡察组"，所以建议分批导入（先导入单位和干部，再导入计划）。

### Step 2.4：导入结果展示

前端显示导入结果：

```
┌──────────────────────────────────────────┐
│  批量导入结果                              │
│                                          │
│  ✅ 成功导入：28 条                        │
│  ❌ 导入失败：3 条                         │
│                                          │
│  [下载失败报告]                            │
│                                          │
│  失败详情：                                │
│  · 第3行：姓名" "格式错误                  │
│  · 第7行：单位"县财政"不存在               │
│  · 第15行：出生年月"1985-xx"格式错误        │
│                                          │
│              [ 关闭 ]                     │
└──────────────────────────────────────────┘
```

---

## Phase 3：打印支持（6-8 小时）

**目标**：支持巡察报告、整改通知书的本地打印（生成 PDF → 浏览器打印）。

### Step 3.1：打印架构

不依赖后端 PDF 生成（避免复杂依赖），采用 **前端打印**方案：
1. 后端只提供数据（JSON）
2. 前端用 React 渲染打印专用页面（隐藏按钮/导航栏）
3. 浏览器 `window.print()` 调用系统打印对话框
4. 用户选择"另存为 PDF"或"打印到打印机"

```
打印流程：点击"打印" → 打开新窗口/iframe → 加载打印模板（隐藏UI）→ window.print()
```

### Step 3.2：打印模板页面

创建 `frontend/src/pages/Print/` 目录：

```
Print/
├── PrintPlanReport.tsx    # 巡察报告打印模板
├── PrintRectification.tsx # 整改通知书打印模板
└── PrintCadreList.tsx     # 干部名册打印模板
```

**巡察报告打印模板**（`PrintPlanReport.tsx`）：

```
┌──────────────────────────────────────────────┐
│            ××县委巡察工作领导小组              │
│              巡 察 报 告                       │
│                                              │
│  巡察单位：县财政局                            │
│  巡察时间：2024年3月1日 — 3月15日              │
│  巡察组：第3巡察组                            │
│                                              │
│  一、总体评价                                  │
│  （正文内容...）                              │
│                                              │
│  二、发现问题                                  │
│  1. 党的领导方面：...                          │
│  2. 党的建设方面：...                          │
│  3. 从严治党方面：...                          │
│                                              │
│  三、整改建议                                  │
│  （正文内容...）                              │
│                                              │
│           第3巡察组（印章）                    │
│           2024年3月20日                        │
└──────────────────────────────────────────────┘
```

**打印样式**（CSS `@media print`）：

```css
@media print {
  body * { visibility: hidden; }
  #print-area, #print-area * { visibility: visible; }
  #print-area {
    position: fixed; left: 0; top: 0; width: 100%;
    padding: 40px 60px;
    font-family: "SimSun", "宋体", serif;
    font-size: 14pt;
    line-height: 2;
  }
  .no-print { display: none !important; }
  @page { margin: 20mm; size: A4; }
}
```

### Step 3.3：打印入口

在相关详情页加"打印"按钮：

- `PlanDetail.tsx`：详情页右上角加"打印巡察报告"按钮
- `RectificationDetail.tsx`：加"打印整改通知书"按钮
- `CadreList.tsx`：加"打印干部名册"按钮（当前 cadres 列表页）

点击按钮 → 打开新窗口加载打印模板 → 自动触发 `window.print()`。

### Step 3.4：后端数据接口

`plans.py` 新增：

```python
@router.get("/plans/{plan_id}/report")
async def get_plan_report(plan_id: UUID, db: AsyncSession = Depends(get_db)):
    """获取巡察报告数据（供打印）"""
    # 返回包含单位、巡察组、底稿数据的完整报告 JSON
```

`rectifications.py` 新增：

```python
@router.get("/rectifications/{rectification_id}/notice")
async def get_rectification_notice(rectification_id: UUID, ...):
    """获取整改通知书数据"""
```

---

## Phase 4：操作日志（审计日志）（3-4 小时）

### Step 4.1：自动化审计中间件

在 FastAPI 后端加一个全局审计中间件，自动记录所有写操作：

```python
# backend/app/core/audit_middleware.py

AUDIT_OPERATIONS = {
    "POST": {"auth/login": "登录", "plans": "创建巡察计划", "groups": "创建巡察组", ...},
    "PUT": {"plans/{id}": "更新巡察计划", "groups/{id}": "更新巡察组", ...},
    "PATCH": {"plans/{id}/status": "更新计划状态", ...},
    "DELETE": {"plans/{id}": "删除巡察计划", ...},
}

async def audit_middleware(request: Request, call_next):
    # 记录所有非 GET 请求（写操作）
    # 提取 user_id, method, path, request_body
    # 写入 AuditLog 表
```

### Step 4.2：审计日志页面（前端）

`Admin/Audit/AuditLog.tsx` 已有，只需加筛选条件：
- 时间范围（默认最近 30 天）
- 操作人
- 操作类型（创建/更新/删除/登录）
- 模块（计划/巡察组/干部/单位/整改）

**政府常用审计记录**：
- 登录/登出
- 新建/编辑/删除 巡察计划
- 新建/编辑/删除 巡察组
- 新建/编辑/删除 干部信息
- 新建/编辑/删除 单位信息
- 状态变更（草稿↔正式、整改中↔已完成）
- 数据导入（批量导入干部/单位/计划）

---

## Phase 5：桌面端打包（8-10 小时）

### Step 5.1：后端改造

**静态文件嵌入**：修改 `backend/main.py`，打包后前端构建产物嵌入后端二进制：

```python
# backend/main.py
import os, sys

# 打包后 static 文件在同目录的 static/ 下
if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS  # PyInstaller 临时目录
else:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

static_dir = os.path.join(base_dir, 'static')
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
```

**数据库路径**：放用户数据目录（打包后代码目录不可写）：

```python
# backend/config.py
import platform, os

USER_DATA_DIR = {
    "Windows": os.path.join(os.environ["APPDATA"], "巡察工作管理平台"),
    "Darwin": os.path.join(os.path.expanduser("~/Library/Application Support"), "巡察工作管理平台"),
    "Linux": os.path.join(os.path.expanduser("~/.config"), "巡察工作管理平台"),
}[platform.system()]

DB_PATH = os.path.join(USER_DATA_DIR, "patrol.db")
os.makedirs(USER_DATA_DIR, exist_ok=True)
```

**入口脚本** `backend/start.py`：

```python
# backend/start.py
import uvicorn, sys, os

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=18800,
        reload=False,
        log_level="info"
    )
```

### Step 5.2：PyInstaller 打包

```python
# backend/patrol_backend.spec
from PyInstaller.utils.parts import Analysis, PYZ, EXE

a = Analysis(
    ['start.py'],
    hiddenimports=[
        'uvicorn', 'uvicorn.loops', 'uvicorn.loops.auto',
        'fastapi', 'pydantic', 'sqlalchemy.ext.asyncio',
        'sqlalchemy.sql', 'pysqlcipher3',
        'apscheduler', 'openpyxl', 'bcrypt', 'python_jose',
        'passlib', 'python-multipart', 'email_validator',
        'starlette', 'starlette.routing', 'starlette.middleware',
        'starlette.middleware.cors', 'starlette.staticfiles',
    ],
)
pyz = PYZ(a.pure, a.zipped_data)
exe = EXE(
    pyz, a.scripts,
    name='patrol_backend',
    icon='assets/icon.ico',  # Windows exe 图标
    console=True,  # Windows 下显示控制台（方便调试错误）
    disable_windowed_traceback=True,
)
coll = COLLECT(
    exe, a.binaries, a.zipfiles, a.datas,
    name='patrol_backend',
    strip=False, upx=False,
)
```

### Step 5.3：Electron 桌面壳

**目录结构**：
```
patrol-platform-desktop/
├── main/
│   ├── main.ts           # Electron 主进程
│   ├── preload.ts        # contextBridge 桥接
│   ├── ipc-handlers.ts   # IPC 通信处理
│   └── get-local-ip.ts   # 获取本机局域网 IP
├── package.json
├── electron-builder.yml
├── vite.config.ts
└── assets/
    ├── icon.ico
    └── icon.icns
```

**Electron 主进程**（`main.ts` 核心逻辑）：

```typescript
import { app, BrowserWindow, ipcMain, dialog, Menu, Tray } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const MAIN_URL = 'http://127.0.0.1:18800';
const BACKEND_PORT = 18800;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 1. 启动后端（检查健康状态）
async function startBackend(): Promise<void> {
  const exePath = getBackendExePath();
  console.log('[Electron] Starting backend:', exePath);
  const child = spawn(exePath, [], { stdio: 'pipe', detached: true });
  child.unref();

  // 等待后端就绪
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try {
      const r = await fetch(`${MAIN_URL}/health`);
      if (r.ok) { console.log('[Electron] Backend ready'); return; }
    } catch {}
  }
  throw new Error('后端启动超时（60秒）');
}

// 2. 获取本机局域网 IP
async function getLocalIP(): Promise<string> {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// 3. 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1200, minHeight: 700,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
    icon: path.join(__dirname, '../assets/icon.ico'),
    show: false,
  });

  mainWindow.loadURL(MAIN_URL);

  mainWindow.once('ready-to-show', async () => {
    mainWindow!.show();
    const ip = await getLocalIP();
    dialog.showMessageBox({
      type: 'info',
      title: '巡察工作管理平台',
      message: `本机访问：http://localhost:${BACKEND_PORT}`,
      detail: `局域网访问：http://${ip}:${BACKEND_PORT}\n\n其他科室电脑浏览器打开上述地址即可使用。`,
    });
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// 4. 系统托盘
function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/icon.ico'));
  const ctxMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => { (app as any).isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(ctxMenu);
  tray.setToolTip('巡察工作管理平台');
  tray.on('double-click', () => mainWindow?.show());
}
```

**IPC 通信**（主进程 ↔ 渲染进程隔离）：

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  openPrintDialog: () => ipcRenderer.invoke('open-print-dialog'),
});
```

### Step 5.4：electron-builder 配置

```yaml
# electron-builder.yml
appId: com.patrol.platform
productName: 巡察工作管理平台
copyright: Copyright © 2024
directories:
  output: dist-desktop
  buildResources: assets

files:
  - dist/**/*
  - backend-dist/**/*

extraResources:
  - from: backend-dist/patrol_backend/
    to: patrol_backend/
    filter:
      - "**/*"

win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.ico
  artifactName: "${productName}Setup.${ext}"

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: assets/icon.icns
  category: public.app-category.business

nsis:
  oneClick: false
  perMachine: true
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: 巡察工作管理平台
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico

afterPack: |
  // 安装后脚本：创建用户数据目录
  // Windows: %APPDATA%\巡察工作管理平台\
  // Mac: ~/Library/Application Support/巡察工作管理平台/
```

### Step 5.5：构建脚本

```bash
#!/bin/bash
# scripts/build-desktop.sh

set -e

echo "=== Step 1: 构建前端 ==="
cd frontend && npm install && npm run build && cd ..

echo "=== Step 2: PyInstaller 打包后端 ==="
cd backend
# 复制前端构建产物到 static 目录
cp -r ../frontend/dist ./app/static/
# PyInstaller 打包
pyinstaller patrol_backend.spec --clean
cd ..

echo "=== Step 3: 构建 Electron ==="
cd patrol-platform-desktop
npm install
npm run build

echo "=== 完成 ==="
ls -la patrol-platform-desktop/dist-desktop/
```

---

## Phase 6：局域网访问 + 初始化向导（2 小时）

### Step 6.1：首次启动向导

桌面应用首次启动时，显示初始化向导（Electron 拦截 `GET /health` 返回 404 时触发）：

```
┌──────────────────────────────────────────────┐
│  巡察工作管理平台 — 初始化设置                 │
│                                              │
│  第1步：设置管理员账户                         │
│  用户名：admin                                │
│  密码：    [********]                        │
│  确认密码：[********]                         │
│                                              │
│  第2步：设置数据库密码                         │
│  （用于加密存储本地数据，请妥善保管）            │
│  密码：    [________________]                │
│  确认密码：[________________]                │
│                                              │
│            [ 下一步 ]  [ 取消 ]               │
└──────────────────────────────────────────────┘
```

初始化完成后，保存配置文件 `~/.patrol-platform/config.json`：

```json
{
  "version": "1.0.0",
  "db_encrypted": true,
  "admin_username": "admin",
  "setup_complete": true
}
```

### Step 6.2：局域网访问说明

启动后自动弹框显示局域网访问地址（Phase 5 已包含）。

---

## Phase 7：数据迁移（现有数据）（1-2 小时）

### Step 7.1：导出导入脚本

```bash
# 导出
python -m backend.scripts.export_db --format=json --output=patrol_backup_$(date +%Y%m%d).json

# 导入
python -m backend.scripts.import_db --input=patrol_backup_20240315.json --format=json
```

支持字段映射（源数据列名 → 目标数据库列名）。

---

## 工作量汇总

| Phase | 内容 | 预计时间 |
|-------|------|---------|
| Phase 0 | 功能简化（砍审批流程 + 清理 RBAC）| 6-8 小时 |
| Phase 1 | 数据库加密（SQLCipher）| 4-5 小时 |
| Phase 2 | Excel 批量导入（计划/干部/单位）| 6-8 小时 |
| Phase 3 | 打印支持（巡察报告/整改通知书）| 6-8 小时 |
| Phase 4 | 操作日志（审计日志）| 3-4 小时 |
| Phase 5 | 桌面端打包（PyInstaller + Electron）| 8-10 小时 |
| Phase 6 | 初始化向导 + 局域网配置 | 2 小时 |
| Phase 7 | 数据迁移工具 | 1-2 小时 |
| **合计** | | **36-49 小时** |

---

## 文件变更清单

### 新增文件

```
patrol_platform/
├── backend/start.py                        # PyInstaller 入口
├── backend/patrol_backend.spec             # PyInstaller spec
├── backend/app/static/                      # 前端构建产物嵌入目录
├── backend/scripts/
│   ├── export_db.py                         # 数据导出脚本
│   └── import_db.py                         # 数据导入脚本
├── patrol-platform-desktop/                 # Electron 项目（新建）
│   ├── main/
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   ├── ipc-handlers.ts
│   │   └── get-local-ip.ts
│   ├── package.json
│   ├── electron-builder.yml
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── assets/
│       ├── icon.ico
│       └── icon.icns
├── frontend/src/pages/Print/
│   ├── PrintPlanReport.tsx
│   ├── PrintRectification.tsx
│   └── PrintCadreList.tsx
├── frontend/src/pages/Cadres/
│   ├── CadreImportModal.tsx                # 干部批量导入弹窗
│   └── CadreList.tsx（改）                  # 加导入按钮
├── frontend/src/pages/Units/
│   ├── UnitImportModal.tsx                  # 单位批量导入弹窗
│   └── UnitList.tsx（改）
├── frontend/src/pages/Plan/Plans/
│   ├── PlanImportModal.tsx                 # 计划批量导入弹窗
│   └── PlanList.tsx（改）
└── scripts/
    └── build-desktop.sh                    # 打包构建脚本
```

### 修改文件

```
patrol_platform/
├── backend/requirements.txt                 # +pysqlcipher3
├── backend/app/config.py                    # +DB_PASSWORD + 用户数据目录
├── backend/app/main.py                     # + 静态文件挂载
├── backend/app/dependencies.py              # 保留 get_current_user
├── backend/app/api/v1/cadres.py            # + POST /cadres/import
├── backend/app/api/v1/units.py             # + POST /units/import
├── backend/app/api/v1/plans.py             # - 审批流程，+ 导入，简化状态
├── backend/app/api/v1/groups.py            # - 审批流程，简化状态
├── backend/app/api/v1/rectifications.py    # - 审批流程，简化状态
├── backend/app/models/user.py              # 保留（精简字段）
├── backend/app/models/audit_log.py         # 保留（已在用）
├── frontend/src/pages/Admin/Users/         # 简化（只剩改密码）
├── frontend/src/pages/Admin/Roles/         # 删除
├── frontend/src/pages/Admin/Modules/       # 删除
└── frontend/vite.config.ts                  # build outDir → backend/app/static
```

---

## 潜在风险

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| SQLCipher 安装失败（Windows C++ 编译） | Phase 1 阻塞 | 改用 `pysqlite3-ccipher` wheel 或 Docker 镜像预编译 |
| PyInstaller 体积过大（500MB+）| 用户体验 | 启用 UPX 压缩，剔除调试符号；目标 200-300MB |
| 多用户并发写入 SQLite | 数据损坏 | SQLite WAL 模式；政府内网 < 10 人可控；未来可切 PostgreSQL |
| Excel 导入编码问题（Windows）| 批量导入失败 | 强制使用 UTF-8 BOM 格式；提供模板下载 |
| 浏览器打印跨平台样式不一致 | 打印格式错乱 | 提供 @media print CSS；测试 Chrome/Edge/Firefox |

---

## 开放问题

1. **巡察报告内容谁来填写？** 是有固定模板自动生成，还是需要手动编辑富文本内容？
2. **整改通知书格式是否有固定模板？** 是使用现有内容自动填充，还是有固定格式？
3. **初始数据从哪里来？** 是全新部署，还是需要从现有 Excel/Word 文档迁移历史数据？
4. **系统是否需要备份/恢复功能（GUI 界面）？** 还是只需命令行工具就够了？
5. **两位同事如何使用同一套数据？** A 在电脑上操作，B 也在同一台电脑上操作（双用户），还是 B 在另一台电脑通过局域网访问？
