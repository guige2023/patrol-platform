# 巡察工作管理平台 - 完整开发需求

> 生成时间: 2026-04-12
> 项目: patrol-platform
> 目标: 可交付的完整产品

---

## 一、问题总览

| 模块 | 严重程度 | 问题数 | 状态 |
|------|---------|-------|------|
| 知识库 | 🔴 严重 | 4 | 查看/编辑/删除全部失效 |
| 计划管理 | 🔴 严重 | 3 | 表单缺少10+字段，日期不提交 |
| 巡察组 | 🔴 严重 | 3 | 成员无法查看/移除 |
| 底稿管理 | 🔴 严重 | 2 | 提交功能失效 |
| 整改督办 | 🟡 中等 | 3 | 进度无法更新，缺字段 |
| 干部档案 | 🟡 中等 | 3 | 导出失效，缺字段 |
| 线索管理 | 🟡 中等 | 2 | 状态显示英文，无移交详情 |
| 用户管理 | 🟡 中等 | 3 | 编辑按钮无功能 |
| 数据看板 | 🔴 严重 | 2 | 统计卡片不可点击 |

---

## 二、关键架构问题（需优先修复）

### 2.1 API 路由末尾斜杠不一致

**根因**: 前端 API 客户端对所有路径自动添加末尾 `/`，但后端部分路由不带 `/`。

**影响范围**:
- `GET /knowledge/{id}/` → 404（后端是 `/knowledge/{id}`）
- `PUT /knowledge/{id}/` → 404
- `DELETE /knowledge/{id}/` → 404
- `GET /plans/{id}/` → 404
- `PUT /plans/{id}/` → 404
- `GET /cadres/{id}/` → 404
- `DELETE /cadres/{id}/` → 404
- `GET /drafts/{id}/` → 404

**修复方案**: 后端所有 RESTful 路由统一加 `/` 结尾，或前端 axios 配置 `axios.defaults.paramsSerializer` 处理。

---

### 2.2 后端 auth 中间件鉴权问题

**现象**: 浏览器登录后后续请求 403，前端 token 未正确存入 localStorage。

**需排查**:
- `Login/index.tsx` 中 `login()` 是否正确 await
- `setAuthToken()` 在 `login()` 成功后才调用
- 浏览器 localStorage token 存在但 axios 请求头没带

---

## 三、知识库（Knowledge）— 🔴 严重

### 3.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | 点击"查看"提示 "Not authenticated" | 🔴 | GET `/knowledge/{id}/` → 404 |
| 2 | 编辑知识后保存失败 | 🔴 | PUT `/knowledge/{id}/` → 404 |
| 3 | 删除知识失败 | 🔴 | DELETE `/knowledge/{id}/` → 404 |
| 4 | 发布知识失败 | 🔴 | DELETE `/knowledge/{id}/publish` 路径错误 |
| 5 | 查看模式下表单无数据 | 🔴 | `getKnowledge(id)` 返回 response 未正确解析 |

### 3.2 需补充字段

后端 `KnowledgeCreate` 支持但前端未实现:
- `content` - 知识内容（富文本）
- `source` - 来源
- `effective_date` - 生效日期
- `attachments` - 附件列表

### 3.3 验收标准

- [ ] 新建知识 → 保存成功 → 列表显示
- [ ] 点击"查看" → 弹窗显示完整知识内容
- [ ] 点击"编辑" → 弹窗填充现有数据 → 保存成功
- [ ] 点击"删除" → 确认弹窗 → 删除成功
- [ ] 点击"发布" → 状态变为"已发布"

---

## 四、计划管理（Plans）— 🔴 严重

### 4.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | 编辑计划 → 保存后日期范围未更新 | 🔴 | `planned_date_range` 构造了但未发送到后端 |
| 2 | 新建/编辑计划缺少10+字段 | 🔴 | PlanDetail 表单严重残缺 |
| 3 | 查看计划详情只显示3个字段 | 🔴 | 详情弹窗只有 name/year/round_name |

### 4.2 需补充字段（PlanDetail 表单）

```
必填:
- 计划名称 name (已有)
- 年份 year (已有)
- 轮次名称 round_name (已有)

缺失重要字段:
- 巡察范围 scope
- 巡察目标 goals
- 重点领域 focus_areas
- 授权文件 authorization_letter
- 授权日期 authorization_date
- 计划开始日期 planned_start_date
- 计划结束日期 planned_end_date
- 版本号 version
- 版本历史 version_history
```

### 4.3 验收标准

- [ ] 新建计划 → 填写所有字段 → 保存成功 → 列表显示
- [ ] 查看计划 → 弹窗显示全部字段（不可编辑）
- [ ] 编辑计划 → 修改任意字段 → 保存成功
- [ ] 状态流转: 草稿→提交→批准→发布（每个按钮可点）

---

## 五、巡察组（Groups）— 🔴 严重

### 5.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | "查看"弹窗不显示成员列表 | 🔴 | GroupDetail 只调用 `getGroup(id)` 不获取 members |
| 2 | 成员添加成功后无法查看 | 🔴 | 无获取成员列表的 API 调用 |
| 3 | "移除成员"按钮完全缺失 | 🔴 | UI 未实现 |
| 4 | 新建巡察组表单缺少字段 | 🟡 | 只有 name/group_leader_id |

### 5.2 需补充字段（GroupDetail 详情弹窗）

```
- 关联计划 plan_name（当前只显示 plan_id）
- 目标单位 target_unit（当前只显示 id）
- 成员列表 members[]（当前完全缺失）
  - 每行: 干部姓名, 职务, 角色(组长/副组长/组员)
  - 操作: 移除
- 状态 status
- 创建时间
```

### 5.3 需补充字段（GroupMemberModal）

```
当前只有干部选择器，需补充:
- 成员角色 role (组长/副组长/普通组员)
- 任职日期 assignment_date
- 备注 remark
```

### 5.4 验收标准

- [ ] 查看巡察组 → 弹窗显示完整信息 + 成员列表
- [ ] 添加成员 → 选择干部 + 角色 → 添加成功 → 成员列表更新
- [ ] 移除成员 → 确认 → 移除成功 → 成员列表更新
- [ ] 新建巡察组 → 填写所有字段 → 保存成功

---

## 六、底稿管理（Drafts）— 🔴 严重

### 6.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | "提交"按钮失效 | 🔴 | action 作为 query 参数而非 body 发送 |
| 2 | 查看详情不显示关联单位/巡察组 | 🟡 | 只存 ID，不显示名称 |
| 3 | 新建底稿缺少字段 | 🟡 | investigation_dates/location/participants 缺失 |

### 6.2 需补充字段（DraftDetail 表单）

```
缺失字段:
- 巡察组 group_id → 应显示 group_name
- 被巡察单位 unit_id → 应显示 unit_name
- 问题类别 category (已有)
- 问题类型 problem_type (已有)
-  Investigation日期 investigation_start_date
-  Investigation结束日期 investigation_end_date
- 调查地点 location
- 参与人员 participants
- 严重程度 severity
- 状态 status (已有)
```

### 6.3 验收标准

- [ ] 新建底稿 → 关联计划/被巡察单位/巡察组 → 保存成功
- [ ] 查看底稿 → 显示关联单位名称和巡察组名称
- [ ] 点击"提交" → 状态变为"初审"
- [ ] 底稿状态完整流转

---

## 七、整改督办（Rectifications）— 🟡 中等

### 7.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | 进度条显示但无法更新 | 🔴 | 无进度更新 UI，后端 PATCH 未调用 |
| 2 | 新建整改缺少 alert_level | 🟡 | 前端未传预警级别 |
| 3 | 整改日期字段缺失 | 🟡 | rectification_date/completion_date 未显示 |

### 7.2 需补充字段（RectificationModal）

```
缺失:
- 预警级别 alert_level (red/yellow/green)
- 整改日期 rectification_date
- 完成日期 completion_date
- 整改要求 rectification_requirements
- 审核意见 verification_comment
```

### 7.3 验收标准

- [ ] 新建整改 → 填写所有字段 → 保存成功
- [ ] 查看整改 → 显示完整信息
- [ ] 点击"签收" → 状态变更
- [ ] 可更新整改进度 → 进度条同步更新

---

## 八、干部档案（Cadres）— 🟡 中等

### 8.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | "导出"按钮无效 | 🔴 | fetch URL 错误，未通过 axios |
| 2 | CadreModal 缺少 position/rank 字段 | 🟡 | 表单不完整 |
| 3 | 列表不显示所属单位名称 | 🟡 | 只显示 unit_id |

### 8.2 需补充字段（CadreModal）

```
缺失字段:
- 职务 position
- 职级 rank
- 民族 ethnicity
- 籍贯 native_place
- 政治面貌 political_status
- 学历 education
- 学位 degree
- 入党日期 party_join_date
- 工作经历 work_experience
- 简历 resume
- 入职日期 hire_date
```

### 8.3 验收标准

- [ ] 新建干部 → 填写完整档案 → 保存成功
- [ ] 查看干部 → 显示所有字段
- [ ] 编辑干部 → 修改保存成功
- [ ] 导出 → CSV 下载成功

---

## 九、线索管理（Clues）— 🟡 中等

### 9.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | 状态显示英文 registered/transferred | 🟡 | 无中文映射 |
| 2 | 移交弹窗只显示目标文本框 | 🟡 | 无详细移交信息 |
| 3 | 缺少字段 | 🟡 | clue_type/receive_unit/contact 未显示 |

### 9.2 需补充字段（ClueModal）

```
缺失:
- 线索类型 clue_type
- 接收单位 receive_unit
- 联系人 contact
- 联系方式 contact_phone
- 移交日期 transfer_date
- 移交详情 transfer_details
```

### 9.3 验收标准

- [ ] 状态显示中文: 已登记/已移交/已处置
- [ ] 新建线索 → 完整字段 → 保存成功
- [ ] 移交线索 → 选择目标单位 + 填写说明 → 提交成功

---

## 十、用户管理（Admin Users）— 🟡 中等

### 10.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | "编辑"按钮完全无响应 | 🔴 | onClick handler 缺失 |
| 2 | 缺少删除用户功能 | 🟡 | 无删除按钮 |
| 3 | 新建用户缺少 role/unit 字段 | 🟡 | 表单不完整 |

### 10.2 需补充字段（UserModal）

```
缺失:
- 角色 role (admin/inspector/user)
- 所属单位 unit_id
- 手机号 phone
- 是否启用 is_active
```

### 10.3 验收标准

- [ ] 点击"编辑" → 弹窗填充用户数据 → 修改保存成功
- [ ] 新建用户 → 填写所有字段 → 保存成功
- [ ] 删除用户 → 确认 → 删除成功

---

## 十一、数据看板（Dashboard）— 🔴 严重

### 11.1 问题清单

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | 7个统计卡片不可点击 | 🔴 | 无 `<Link>` 或 onClick |
| 2 | 无快捷入口到具体筛选视图 | 🟡 | 功能缺失 |

### 11.2 需实现

```
统计卡片点击行为:
- 单位档案 → /archive/units
- 巡察计划 → /plan/plans (显示所有)
- 底稿数量 → /execution/drafts
- 线索数量 → /execution/clues
- 整改数量 → /execution/rectifications
- 待整改 → /execution/rectifications?status=dispatched
- 超期整改 → /execution/rectifications?alert=red
```

### 11.3 验收标准

- [ ] 7个统计卡片全部可点击 → 跳转到对应列表
- [ ] 快捷入口完整可用（当前已知部分可用）

---

## 十二、通用组件问题

### 12.1 AntD 兼容性警告（需修复）

| 警告 | 修复方式 |
|------|---------|
| Breadcrumb `itemRender`/`items` 数组 | 已修复 ✅ |
| Modal `destroyOnClose` → `destroyOnHidden` | 已修复 ✅ |
| Spin `tip` prop 警告 | 已修复 ✅ |
| `message` 在 AntApp 外调用 | 已修复 ✅ |
| React Router v7 future flags | 需在 router 配置中设置 `v7_startTransition: true` |

### 12.2 React Router v7 升级警告

在 `App.tsx` 的 `<Router>` 配置中添加:

```tsx
<BrowserRouter future={{
  v7_startTransition: true,
  v7_relativeSplatPath: true,
}}>
```

---

## 十三、完整验收清单

### 13.1 登录与认证
- [ ] 登录 → token 正确存入 localStorage
- [ ] 登录后访问受保护路由正常
- [ ] 登出 → token 清除 → 跳转登录页

### 13.2 知识库
- [ ] 新建知识（完整字段）
- [ ] 查看知识详情（显示 content/source/effective_date）
- [ ] 编辑知识（修改任意字段）
- [ ] 删除知识（确认弹窗）
- [ ] 发布知识（状态变更）
- [ ] 搜索 + 筛选
- [ ] 分页

### 13.3 计划管理
- [ ] 新建计划（全部 ~12 个字段）
- [ ] 查看计划详情（全部字段，只读）
- [ ] 编辑计划
- [ ] 提交 → 批准 → 发布（状态流转）
- [ ] 分页 + 搜索

### 13.4 巡察组
- [ ] 新建巡察组
- [ ] 查看巡察组详情（含成员列表）
- [ ] 添加成员（选干部 + 角色）
- [ ] 移除成员
- [ ] 分页

### 13.5 底稿管理
- [ ] 新建底稿（关联计划和单位）
- [ ] 查看底稿详情（显示单位名称 + 组名称）
- [ ] 提交底稿
- [ ] 删除底稿
- [ ] 分页 + 搜索

### 13.6 线索管理
- [ ] 新建线索（完整字段）
- [ ] 查看线索详情
- [ ] 移交线索（目标单位 + 说明）
- [ ] 状态显示中文
- [ ] 分页 + 搜索

### 13.7 整改督办
- [ ] 新建整改（alert_level + 日期字段）
- [ ] 查看整改详情
- [ ] 签收整改
- [ ] 更新整改进度（进度条）
- [ ] 分页 + 搜索

### 13.8 干部档案
- [ ] 新建干部（完整档案 ~20 个字段）
- [ ] 查看干部详情（完整档案）
- [ ] 编辑干部
- [ ] 删除干部
- [ ] 导入干部（Excel）
- [ ] 导出干部（CSV）
- [ ] 分页 + 搜索

### 13.9 用户管理
- [ ] 新建用户（role + unit + phone）
- [ ] 编辑用户
- [ ] 删除用户
- [ ] 分页

### 13.10 数据看板
- [ ] 7个统计卡片全部可点击
- [ ] 点击跳转对应列表
- [ ] 底稿分类统计图
- [ ] 线索来源统计图
- [ ] 整改预警统计

---

## 十四、优先级排序

### P0（必须修复，否则无法使用）
1. **知识库查看/编辑/删除** — trailing slash 404
2. **用户登录后 403** — auth middleware 问题
3. **Dashboard 统计卡片不可点击** — 功能完全缺失

### P1（核心功能不完整）
4. **计划管理表单缺少10+字段** — 数据严重残缺
5. **巡察组成员查看/移除** — 成员管理不完整
6. **底稿提交失效** — action 参数发送方式错误
7. **用户管理编辑按钮无响应** — CRUD 不完整

### P2（功能完善）
8. **整改进度无法更新** — 缺少更新 UI
9. **干部档案 position/rank 缺失** — 表单不完整
10. **线索状态显示英文** — 中文本地化

### P3（体验优化）
11. **巡察组详情显示单位/计划名称** — ID 换名称
12. **底稿详情显示单位/组名称** — ID 换名称
13. **React Router v7 future flags** — 消除 warning

---

*本文档为兔叔私有财产，未经授权不得外传。*
