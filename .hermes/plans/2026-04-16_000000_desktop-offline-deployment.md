# 巡察工作管理平台 — 桌面端离线部署方案（定稿版）

## 定位

**巡察工作全生命周期管理平台** — 所有工作均在系统内完成，
涉及外部单位和个人的，通过导出/导入 Excel 模板解决，确保数据完整及时更新。

```
外部单位/个人 → 下载模板 → 填写 → 导入系统 → 系统统计展示 + 预警
```

---

## 部署拓扑

```
┌─────────────────────────────────────────────────────────────┐
│  政府内网服务器（单机部署）                                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  巡察工作管理平台（Electron 桌面应用）                  │  │
│  │  ├── FastAPI 后端（0.0.0.0:18800）                   │  │
│  │  ├── SQLite 数据库（SQLCipher 加密）                   │  │
│  │  ├── 预警引擎（APScheduler 每日扫描）                  │  │
│  │  └── Electron 窗口（前端 React）                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
│  局域网：http://192.168.1.x:18800                          │
└─────────────────────────────────────────────────────────────┘
           ▲
           │  局域网 HTTP 访问（多用户）
           │
  ┌─────────────────────────────────────────────────────┐
  │  科室电脑 A → 浏览器登录账户 A                          │
  │  科室电脑 B → 浏览器登录账户 B                          │
  │  外部单位 → 下载模板 → 填写 → 导入系统                  │
  └─────────────────────────────────────────────────────┘
```

---

## 确认需求清单

| 需求 | 确认 |
|------|------|
| 多账户独立登录，平等权限（无审批层级） | ✅ |
| SQLite 数据库加密存储（SQLCipher）| ✅ |
| 巡察公告、成立巡察组通知、部署会通知、反馈意见、整改通知书本地打印 | ✅（去掉巡察报告） |
| Excel 批量导入（计划/干部/单位） | ✅ |
| 操作日志（审计日志）| ✅ |
| 无自动更新推送 | ✅ |
| 巡察组有组长 + 副组长（不只是组长）| ✅ |
| 时间节点在系统配置里可灵活修改 | ✅ |
| 首页数据看板（全面反映巡察情况）| ✅ |
| 整改情况由被巡察单位按模板填报后导入系统 | ✅ |
| 局域网部署，多用户访问 | ✅ |
| 所有工作都在系统内完成，外部数据通过模板导入 | ✅ |

---

## Phase 0：功能简化（先做）

### Step 0.1：巡察计划状态简化为两态

- 去掉：提交审批、批准、发布等步骤
- 保留：草稿 ↔ 正式（启用/停用）
- `is_active=True` 即正式状态

### Step 0.2：巡察组增加副组长字段

**后端**：
```python
# backend/app/models/inspection_group.py
class InspectionGroup(Base):
    leader_id: Mapped[UUID]      # 组长
    deputy_leader_id: Mapped[UUID]  # 副组长（新增）
    members: Mapped[List["GroupMember"]]
```

**前端**：GroupDetail/GroupList 显示组长 + 副组长

### Step 0.3：砍 RBAC 复杂权限

- 删除：角色管理页面、权限配置页面
- 保留：账户管理（改密码）、审计日志
- 用户平等权限，不分超管/审核员/普通用户

---

## Phase 1：数据库加密（SQLCipher）

同原方案，用户首次启动设置数据库密码，存储在 `~/.patrol-platform/config.json`。

---

## Phase 2：系统配置模块（核心新增）

**目标**：将所有时间节点做成可配置项，用户随时修改。

### 2.1 配置数据模型

```python
# backend/app/models/system_config.py
class SystemConfig(Base):
    key: str          # 唯一键，如 "regular_inspection_days"
    value: str        # 值，如 "60"
    unit: str         # 单位，如 "天"
    description: str  # 说明，如 "常规巡察每轮天数"
    category: str     # 分类，如 "巡察配置"
```

**预设配置项**：

| 键 | 预设值 | 单位 | 说明 |
|----|--------|------|------|
| `regular_inspection_days` | 60 | 天 | 常规巡察每轮天数 |
| `special_inspection_days` | 30 | 天 | 专项巡察天数 |
| `supervision_week_min` | 2 | 周 | 进驻后实地督导（第X周开始）|
| `supervision_week_max` | 3 | 周 | 进驻后实地督导（第X周结束）|
| `midterm_week` | 6 | 周 | 中期听取报告（第X周）|
| `rectification_months_min` | 2 | 月 | 整改期限（最短）|
| `rectification_months_max` | 3 | 月 | 整改期限（最长）|
| `reinspection_months_min` | 3 | 月 | 整改督查（最短，回头看）|
| `reinspection_months_max` | 6 | 月 | 整改督查（最长，回头看）|

### 2.2 前端配置页面

`/admin/system-configs` 页面：

```
┌──────────────────────────────────────────────────────────┐
│  系统配置                                                  │
│                                                          │
│  巡察配置                                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │  常规巡察每轮天数   [ 60 ] 天                      │ │
│  │  专项巡察天数       [ 30 ] 天                      │ │
│  │  进驻后实地督导    第 [ 2 ] 周 至 第 [ 3 ] 周      │ │
│  │  中期听取报告       第 [ 6 ] 周                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  整改配置                                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │  整改期限         [ 2 ] 至 [ 3 ] 个月              │ │
│  │  整改督查（回头看） [ 3 ] 至 [ 6 ] 个月             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│                    [ 保存配置 ]                          │
└──────────────────────────────────────────────────────────┘
```

用户修改后，预警引擎在下一次扫描时自动使用新配置。

---

## Phase 3：巡察全流程状态机

### 3.1 计划/巡察组状态模型

```python
class InspectionPhase(str, Enum):
    # 准备阶段
    PLANNING = "planning"           # 制定计划中
    PLAN_APPROVED = "plan_approved" # 计划已制定（正式）
    # 组建阶段
    GROUP_FORMING = "group_forming" # 组建巡察组中
    GROUP_READY = "group_ready"     # 巡察组已就绪
    # 进驻阶段
    ANNOUNCING = "announcing"       # 发布巡察公告
    DEPLOYING = "deploying"         # 召开部署会
    IN_PROGRESS = "in_progress"     # 巡察进行中
    # 报告阶段
    REPORT_DRAFT = "report_draft"   # 撰写报告初稿
    REPORT_FINAL = "report_final"   # 报告定稿
    # 反馈阶段
    FEEDBACK = "feedback"           # 反馈意见
    # 整改阶段
    RECTIFYING = "rectifying"       # 整改中
    RECTIFICATION_DONE = "rectification_done"  # 整改完成
    REINSPECTION = "reinspection"   # 回头看
    CLOSED = "closed"               # 归档
```

### 3.2 状态流转图

```
PLANNING → PLAN_APPROVED → GROUP_FORMING → GROUP_READY
    → ANNOUNCING → DEPLOYING → IN_PROGRESS
    → REPORT_DRAFT → REPORT_FINAL → FEEDBACK
    → RECTIFYING → RECTIFICATION_DONE
    → REINSPECTION → CLOSED
```

### 3.3 每个阶段记录关键时间

```python
class Plan(Base):
    id: UUID
    name: str
    phase: InspectionPhase
    # 时间节点
    plan_date: date          # 计划制定日期
    approve_date: date       # 计划批准日期
    group_form_date: date    # 巡察组成立日期
    announce_date: date      # 公告发布日期
    deploy_date: date        # 部署会日期
    actual_start_date: date  # 实际进驻日期
    report_draft_date: date # 初稿日期
    report_final_date: date # 报告定稿日期
    feedback_date: date      # 反馈日期
    rectification_start: date # 整改开始日期
    rectification_end: date  # 整改截止日期（计算得出）
    reinspection_date: date # 回头看日期（计算得出）
    close_date: date        # 归档日期
```

### 3.4 前端每个阶段显示

PlanDetail 页面显示当前阶段 + 阶段时间线，点击阶段可更新日期：

```
┌─────────────────────────────────────────────────────┐
│  2024年度第1轮巡察  |  状态：巡察进行中           │
│                                                     │
│  ●─●─●─●─●─○─○─○─○─○─○─○─○                     │
│  计划  批准  建组  就绪  公告  部署  ←当前  报告  反馈  整改  回头看 归档 │
│                                                     │
│  进驻日期：2024-03-01                              │
│  实际结束：2024-04-30（预计）                      │
│  当前阶段：巡察进行中（第28天/共60天）              │
│                                                     │
│  [更新进驻日期]  [更新阶段]  [生成公文]             │
└─────────────────────────────────────────────────────┘
```

---

## Phase 4：预警引擎

### 4.1 预警规则引擎

```python
# backend/app/services/warning_engine.py
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from datetime import date, timedelta

SCHEDULE_RULES = {
    # 键名对应 SystemConfig.key
    "regular_inspection_days": {...},
    "special_inspection_days": {...},
    "supervision_week_min": {...},
    "midterm_week": {...},
    "rectification_months_min": {...},
    "reinspection_months_max": {...},
}

class WarningEngine:
    def scan(self):
        configs = self.get_configs()
        plans = self.get_active_plans()
        warnings = []

        for plan in plans:
            # 1. 巡察进驻前3天提醒
            days_to_start = (plan.actual_start_date - date.today()).days
            if 0 < days_to_start <= 3:
                warnings.append(Warning(
                    type="upcoming",
                    title="巡察即将进驻",
                    message=f"{plan.name}将于{plan.actual_start_date}进驻",
                    plan_id=plan.id,
                ))

            # 2. 进驻第2-3周提醒（实地督导）
            if plan.actual_start_date:
                days_elapsed = (date.today() - plan.actual_start_date).days
                supervision_start = configs["supervision_week_min"] * 7
                supervision_end = configs["supervision_week_max"] * 7
                if supervision_start <= days_elapsed <= supervision_end:
                    warnings.append(Warning(...))

            # 3. 中期提醒
            if plan.actual_start_date:
                midterm = configs["midterm_week"] * 7
                days_elapsed = (date.today() - plan.actual_start_date).days
                if abs(days_elapsed - midterm) <= 3:
                    warnings.append(Warning(...))

            # 4. 巡察结束前7天提醒
            if plan.actual_start_date:
                total_days = configs.get("regular_inspection_days", 60)
                remaining = total_days - days_elapsed
                if 0 < remaining <= 7:
                    warnings.append(Warning(...))

            # 5. 整改到期前7天提醒
            if plan.rectification_end:
                days_left = (plan.rectification_end - date.today()).days
                if 0 < days_left <= 7:
                    warnings.append(Warning(...))

            # 6. 回头看到期提醒
            if plan.reinspection_date:
                if plan.reinspection_date == date.today():
                    warnings.append(Warning(...))

        # 7. 未巡察单位预警（每年初扫描）
        # 统计已巡察年份，如某单位3年未巡察则预警

        self.save_warnings(warnings)
        return warnings
```

### 4.2 预警触发方式

1. **用户登录后首页红色提示**（最重要）
2. **顶部导航栏角标**（显示预警数量）
3. **首页"今日待办"栏**（列出所有预警）

### 4.3 未巡察单位预警逻辑

```python
def check_units_without_inspection():
    """检查多年未巡察的单位"""
    all_units = db.query(Unit).all()
    for unit in all_units:
        last_inspection = db.query(Plan).join(...).filter(
            Plan.units.contains(unit)
        ).order_by(Plan.actual_start_date.desc()).first()

        if last_inspection:
            years_since = (date.today() - last_inspection.actual_start_date).days / 365
            if years_since >= 3:  # 3年未巡察
                warnings.append(Warning(
                    type="long_term",
                    title="长期未巡察单位",
                    message=f"{unit.name}已{years_since:.1f}年未安排巡察"
                ))
```

---

## Phase 5：首页数据看板（Dashboard）

### 5.1 看板布局

```
┌────────────────────────────────────────────────────────────────┐
│  巡察工作管理平台              🔔 5条预警    [admin ▼]        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  本轮巡察概览                          未巡察单位预警           │
│  ┌─────────────────────────────────┐  ┌────────────────────┐  │
│  │  ●●○○○○○○○  正在进行：2/8轮     │  │ ⚠ 县财政局 3年未巡察 │  │
│  │                                 │  │ ⚠ 县教育局 2.5年未巡 │  │
│  └─────────────────────────────────┘  └────────────────────┘  │
│                                                                │
│  巡察进度追踪                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  第1轮巡察  ████████████░░░░░░░░  45天/共60天  进行中    │ │
│  │  第2轮巡察  ████████████████████  已完成                  │ │
│  │  第3轮巡察  ○○○○○○○░░░░░░░░░░░░  筹备中                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  整改情况统计                          今日预警                │
│  ┌────────────────────┐  ┌────────────────────────────────┐  │
│  │ 待整改:  3个        │  │ 🔴 2024-03-15 县财政局巡察即将进驻 │  │
│  │ 整改中:  5个        │  │ 🟡 2024-03-20 第2轮巡察实地督导  │  │
│  │ 已完成: 12个        │  │ 🔴 2024-04-10 第1轮巡察即将结束   │  │
│  │ 逾期:    1个 ⚠      │  │ 🟡 2024-04-25 县财政局整改到期   │  │
│  └────────────────────┘  └────────────────────────────────┘  │
│                                                                │
│  历年巡察覆盖率                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  2022年：████████████████████░░░░░░░  80%（16/20单位）  │ │
│  │  2023年：████████████████████████░░  95%（19/20单位）  │ │
│  │  2024年：██████████░░░░░░░░░░░░░░░░  50%（10/20单位）  │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 看板数据 API

```python
@router.get("/dashboard/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    plans = await db.execute(select(Plan).where(Plan.is_active == True))
    plans = plans.scalars().all()

    # 当前轮次巡察进度
    current_round = max(p.round for p in plans if p.year == date.today().year)

    # 各阶段统计
    phase_stats = {}
    for phase in InspectionPhase:
        phase_stats[phase] = count

    # 整改统计
    rectification_stats = {
        "pending": count_status("rectifying"),
        "completed": count_status("rectification_done"),
        "overdue": count_rectification_overdue(),
    }

    # 未巡察单位
    units_without_recent = get_long_term_uninspected_units()

    # 历年覆盖率
    yearly_coverage = compute_yearly_coverage()

    return {
        "current_round": current_round,
        "phase_stats": phase_stats,
        "rectification_stats": rectification_stats,
        "warnings": get_active_warnings(),
        "units_without_recent": units_without_recent,
        "yearly_coverage": yearly_coverage,
    }
```

---

## Phase 6：Excel 批量导入/导出

**核心原则**：所有外部数据通过模板导入，不人工录入。

### 6.1 导入模板生成规则

**干部导入**：
- 前端点击"下载干部导入模板" → 后端生成标准 Excel（含表头说明 + 示例行）
- 用户填写 → 前端上传 → 后端解析校验 → 逐行验证错误 → 正确的写入数据库

**单位导入**：同上

**整改情况导入**（重要）：
- 后端预置"整改情况填写模板"（含所有整改项字段）
- 巡察办导出给被巡察单位 → 被巡察单位填写 → 导入系统
- 系统自动更新该单位的整改状态，统计汇总

**巡察进度表格导入**：
- 模板含：巡察组、报告日期、本周工作内容、发现问题数量、问题分类
- 巡察组定期填写 → 导入系统 → 系统自动更新进度

### 6.2 模板导出 API

```python
@router.get("/templates/plan-progress")
async def download_plan_progress_template():
    """导出巡察进度填写模板"""
    wb = Workbook()
    ws = wb.active
    ws.title = "巡察进度报告"

    headers = [
        "巡察组名称", "报告周期", "报告日期",
        "谈话人数", "查阅资料数", "受理信访数", "实地走访数",
        "发现问题总数",
        "党的建设方面问题数", "全面从严治党方面问题数", "重点领域问题数",
        "下周工作计划", "备注"
    ]
    ws.append(headers)
    # 加1行示例
    ws.append(["第1巡察组", "第3周", "2024-03-15", "12", "85", "3", "5", "8", "3", "2", "3", "继续谈话+撰写初稿", ""])

    buf = BytesIO()
    wb.save(buf)
    return StreamingResponse(
        BytesIO(buf.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=巡察进度报告模板.xlsx"}
    )
```

### 6.3 导入 API

```python
@router.post("/import/plan-progress")
async def import_plan_progress(file: UploadFile, db: AsyncSession = Depends(get_db)):
    wb = load_workbook(file.file)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # 跳过表头

    errors = []
    success_count = 0
    for i, row in enumerate(rows, start=2):
        try:
            validate_and_save_progress(row)
            success_count += 1
        except ValidationError as e:
            errors.append(f"第{i}行：{e.message}")

    return {"success": success_count, "errors": errors}
```

---

## Phase 7：公文自动生成

### 7.1 公文类型（5种，去掉巡察报告）

| 序号 | 公文类型 | 模板文件 | 说明 |
|------|---------|---------|------|
| 1 | 巡察公告 | `notice_of_inspection.docx` | 红色报头，告知被巡察单位 |
| 2 | 成立巡察组通知 | `group_establishment.docx` | 文号+公章，通知各相关单位 |
| 3 | 巡察部署会通知 | `deployment_meeting.docx` | 时间地点+参会单位 |
| 4 | 巡察反馈意见 | `inspection_feedback.docx` | 红头文件，反馈给被巡察单位 |
| 5 | 整改通知书 | `rectification_notice.docx` | 整改要求和期限 |

**不包含**：巡察报告（含问题清单）— 这类复杂文档由人工撰写

### 7.2 模板变量替换

```python
# 公文模板填充
from docx import Document
from datetime import date

def fill_notice_template(plan: Plan, group: InspectionGroup, output_path: str):
    doc = Document("templates/notice_of_inspection.docx")

    variables = {
        "{{发文机关}}": "中共XX县委巡察工作领导小组",
        "{{文件标题}}": f"关于对{plan.unit_name}开展巡察工作的公告",
        "{{巡察组名称}}": group.name,
        "{{巡察组组长}}": group.leader.name,
        "{{被巡察单位}}": plan.unit_name,
        "{{巡察时间}}": f"{plan.actual_start_date}至{plan.actual_end_date}",
        "{{发布日期}}": date.today().strftime("%Y年%m月%d日"),
        "{{文号}}": f"x巡组告〔{date.today().year}〕{plan.serial_no}号",
    }

    for para in doc.paragraphs:
        for key, val in variables.items():
            if key in para.text:
                para.text = para.text.replace(key, val)

    doc.save(output_path)
    return output_path
```

### 7.3 前端公文生成入口

在 `PlanDetail.tsx` 侧边栏/操作栏：

```
┌─────────────────────────────────────┐
│  操作                               │
│                                     │
│  [ 生成巡察公告 ]                    │
│  [ 生成成立巡察组通知 ]               │
│  [ 生成部署会通知 ]                  │
│  [ 打印反馈意见 ]                    │
│  [ 打印整改通知书 ]                  │
│                                     │
│  [ 更新阶段日期 ]                    │
│  [ 导入整改情况 ]                   │
│  [ 导入巡察进度 ]                   │
└─────────────────────────────────────┘
```

---

## Phase 8：知识库升级

### 8.1 知识库支持格式

| 格式 | 处理方式 |
|------|---------|
| PDF | 浏览器内置 PDF viewer（`<embed>` 或 `<iframe>`）|
| Word/Excel | 后端转 PDF（`libreoffice --headless --convert-to pdf`）再预览 |
| 图片 | 直接 `<img>` 显示 |
| 纯文本/Markdown | 渲染后显示 |

### 8.2 知识库分类

```
知识库/
├── 政策法规/
│   ├── 巡视工作条例
│   └── 巡察工作规范
├── 模板库/
│   ├── 巡察进度报告模板
│   ├── 整改情况填写模板
│   └── 干部导入模板
├── 培训资料/
│   └── 巡察工作培训PPT
└── 历史巡察资料/（按年份+被巡察单位归档）
```

### 8.3 前端知识库页面

- 左侧分类树
- 右侧文件列表 + 在线预览
- 支持搜索文件名/内容
- 上传时自动按分类归档

---

## Phase 9：桌面端打包（PyInstaller + Electron）

同原方案。最终交付：
- Windows：`巡察工作管理平台Setup.exe`
- Mac：`巡察工作管理平台.dmg`

---

## Phase 10：局域网访问 + 初始化向导

同原方案。启动时显示：
- 本机访问：`http://localhost:18800`
- 局域网访问：`http://192.168.1.x:18800`

---

## Phase 11：备份和恢复（GUI 界面）

### 11.1 备份

前端 `/admin/backup` 页面：
- 点击"创建备份" → 后端复制 `patrol.db` → 前端下载文件
- 文件名：`patrol_backup_YYYYMMDD_HHMMSS.db`

### 11.2 恢复

点击"恢复数据" → 选择 `.db` 文件 → 确认警告 → 上传 → 后端覆盖当前数据库

### 11.3 自动备份

后端每日凌晨3点自动备份到 `~/.patrol-platform/backups/`（保留最近7份）

---

## 工作量汇总

| Phase | 内容 | 预计时间 |
|-------|------|---------|
| Phase 0 | 功能简化 + 巡察组副组长 | 3-4 小时 |
| Phase 1 | 数据库加密（SQLCipher）| 4-5 小时 |
| Phase 2 | 系统配置模块（可配置时间节点）| 4-5 小时 |
| Phase 3 | 巡察全流程状态机（11个阶段）| 6-8 小时 |
| Phase 4 | 预警引擎 | 5-6 小时 |
| Phase 5 | 首页数据看板 | 5-6 小时 |
| Phase 6 | Excel 导入/导出（模板）| 6-8 小时 |
| Phase 7 | 公文生成（5种）| 4-5 小时 |
| Phase 8 | 知识库升级（PDF预览等）| 4-5 小时 |
| Phase 9 | 桌面端打包 | 8-10 小时 |
| Phase 10 | 局域网访问 + 初始化向导 | 2 小时 |
| Phase 11 | 备份恢复（GUI）| 3-4 小时 |
| **合计** | | **54-69 小时** |

---

## 文件变更清单

### 新增文件

```
patrol_platform/
├── backend/app/models/system_config.py       # 系统配置模型
├── backend/app/api/v1/system_configs.py      # 配置 CRUD API
├── backend/app/models/warning.py             # 预警记录模型
├── backend/app/services/warning_engine.py     # 预警引擎
├── backend/app/services/document_generator.py # 公文生成服务
├── backend/app/services/import_service.py     # 导入解析服务
├── backend/templates/                         # 公文 Word 模板
│   ├── notice_of_inspection.docx
│   ├── group_establishment.docx
│   ├── deployment_meeting.docx
│   ├── inspection_feedback.docx
│   └── rectification_notice.docx
├── backend/start.py                          # PyInstaller 入口
├── backend/patrol_backend.spec              # PyInstaller spec
├── patrol-platform-desktop/                   # Electron 项目
│   ├── main/
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── ipc-handlers.ts
│   ├── package.json
│   └── electron-builder.yml
├── frontend/src/pages/Admin/SystemConfigs/  # 系统配置页面
│   └── SystemConfigPage.tsx
├── frontend/src/pages/Dashboard/             # 首页看板
│   └── Dashboard.tsx
├── frontend/src/pages/Knowledge/             # 知识库
│   └── KnowledgeList.tsx
├── frontend/src/pages/Print/                  # 打印模板页
│   ├── PrintNotice.tsx
│   ├── PrintGroupNotice.tsx
│   ├── PrintDeployment.tsx
│   ├── PrintFeedback.tsx
│   └── PrintRectification.tsx
└── scripts/
    └── build-desktop.sh
```

### 修改文件

```
patrol_platform/
├── backend/app/models/inspection_group.py   # + 副组长字段
├── backend/app/models/plan.py              # + 阶段状态 + 11个时间节点
├── backend/app/models/rectification.py       # 整改状态简化
├── backend/app/api/v1/plans.py             # + 阶段流转 API
├── backend/app/api/v1/groups.py             # + 副组长字段
├── backend/app/api/v1/import_export.py     # + 导入导出 API
├── backend/app/main.py                     # + 静态文件挂载
├── frontend/src/pages/Plan/Plans/PlanList.tsx  # 简化状态显示
├── frontend/src/pages/Plan/Groups/GroupDetail.tsx  # + 副组长
├── frontend/src/pages/Dashboard/            # 新建 Dashboard（替换现有首页）
└── frontend/vite.config.ts                  # build outDir → backend/app/static
```
