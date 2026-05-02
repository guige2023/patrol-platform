# 代码审查 - 问题速查表

## 🔴 CRITICAL 问题速查

### C1 - 权限检查异步问题
```
文件: backend/app/dependencies.py
行号: L39-69
修复时间: 4小时
```

**问题**: 在异步函数中同步创建AsyncSession，导致权限检查失效  
**关键词**: `AsyncSessionLocal()`, `await`  
**修复**: 通过函数参数注入AsyncSession

---

### C2 - CSRF保护缺失  
```
文件: backend/app/main.py
行号: 全文
修复时间: 6小时
```

**问题**: 没有CSRF防护，易受跨站请求伪造  
**修复**: 安装 `fastapi-csrf-protect` 并配置中间件

---

### C3 - Docker中密码明文
```
文件: docker-compose.yml
行号: L34
修复时间: 3小时
```

**问题**: `POSTGRES_PASSWORD=${PATROL_DB_PASSWORD}` 在日志中可见  
**修复**: 使用 `.env` 或 `Docker secrets`

---

### C4 - 加密密钥派生不安全
```
文件: backend/app/core/encryption.py
行号: L7-9
修复时间: 5小时
```

**问题**: 使用SHA256而不是PBKDF2进行密钥派生  
**修复**: 改用 `cryptography.hazmat.primitives.kdf.pbkdf2.PBKDF2`

---

### C5 - 路径遍历漏洞
```
文件: backend/app/api/v1/knowledge_files.py
行号: preview_attachment 函数
修复时间: 4小时
```

**问题**: `filename` 参数未验证，可访问任意文件  
**修复**: 验证filename不包含 `..` 和绝对路径，从数据库查询

---

## 🟠 HIGH 问题速查

| # | 文件 | 行号 | 问题 | 修复时间 |
|---|------|------|------|---------|
| H1 | core/security.py, core/rbac.py | - | 权限检查重复实现 | 8小时 |
| H2 | core/audit.py | 16 | JSON字段flush缺失 | 2小时 |
| H3 | api/v1/files.py | 33-47 | 文件访问控制不完整 | 6小时 |
| H4 | 全站 | - | 无速率限制 | 4小时 |
| H5 | database.py | 37-43 | 连接池配置过小 | 2小时 |
| H6 | api/v1/admin.py | 42 | 密码错误信息泄露 | 1小时 |
| H7 | 20个文件 | 多处 | 使用print而非日志 | 6小时 |
| H8 | api/v1/files.py | 28 | 无文件大小限制 | 3小时 |
| H9 | 多个API | - | 易误用的SQL查询模式 | 2小时 |
| H10 | core/security.py | 19 | 无密钥轮换机制 | 4小时 |
| H11 | api/v1/auth.py | 18 | 无暴力破解防御 | 6小时 |
| H12 | main.py | - | 缺少安全HTTP头 | 2小时 |

---

## 🟡 MEDIUM 问题速查

```
M1.  缺少SAST工具             (2小时)  → 使用 bandit + semgrep
M2.  权限模型混乱             (8小时)  → 统一到RBAC
M3.  API版本控制不足          (6小时)  → 实现版本管理
M4.  缺少环保特定配置验证     (4小时)  → 添加验证函数
M5.  OpenAPI未安全配置        (2小时)  → 生产环境禁用文档
M6.  数据库迁移无验证         (4小时)  → 添加验证流程
M7.  敏感操作无二次确认       (6小时)  → 实现MFA/OTP
M8.  分页边界检查             (2小时)  → 改 le=9999 为 le=100
M9.  缺少字段级加密           (8小时)  → 加密PII字段
M10. 缺少数据脱敏             (6小时)  → 在响应中脱敏
M11. Token存localStorage      (6小时)  → 改为httpOnly Cookie
M12. 缺少CSP头                (4小时)  → 配置Content-Security-Policy
M13. 缺少SRI                  (2小时)  → 添加Subresource Integrity
M14. 错误消息过详细           (4小时)  → 生产使用通用消息
M15. 数据验证不一致           (6小时)  → 统一验证规则
M16. 缺少依赖版本锁定         (2小时)  → 使用 pip-compile
M17. 缺少漏洞扫描             (4小时)  → 配置 GitHub Actions
M18. 前端缺Error Boundary     (4小时)  → 添加错误边界组件
```

---

## 🟢 LOW 问题速查

```
L1.  过多print()调用          → 改为 structlog
L2.  缺少type hints           → 启用 mypy/pyright
L3.  函数过长                 → plans.py分解
L4.  缺少单元测试             → 目标80%覆盖率
L5.  前端无重试逻辑           → 实现指数退避
L6.  缺少日志级别配置         → 支持按模块配置
L7.  魔数硬编码               → 提取为常量
L8.  缺少性能监控             → 集成Sentry
L9.  查询无优化               → 添加joinload
L10. 限流无细粒度配置         → 不同端点不同限制
L11. 前端库版本过旧           → 更新antd到最新
L12. 缺少国际化               → i18n支持
L13. API文档无规范            → 统一文档格式
L14. 导出无验证               → 验证完整性
```

---

## 🛠️ 快速修复命令

### 检查依赖漏洞
```bash
# Python
pip install pip-audit
pip-audit

# Node.js
npm audit
npm audit fix
```

### 运行代码检查
```bash
# 后端
cd backend
pip install bandit semgrep
bandit -r app/ --ll
semgrep --config=p/security-audit app/

# 前端
cd frontend
npm install eslint @typescript-eslint/eslint-plugin
npm run lint
```

### 生成测试覆盖率
```bash
# 后端
pytest --cov=app backend/tests/
pytest --cov=app --cov-report=html backend/tests/
# 打开 htmlcov/index.html

# 前端
npm test -- --coverage
```

---

## ✅ 每日检查清单

### 开发前检查
```
□ 从main分支pull最新代码
□ 检查是否有新的CVE通知
□ 阅读相关的修复计划
□ 准备dev环境
```

### 开发中检查  
```
□ 运行 eslint / bandit
□ 编写单元测试（TDD）
□ 不使用 print()，使用日志
□ 不硬编码密钥/密码
□ 验证所有用户输入
□ 检查SQL参数化
```

### 提交前检查
```
□ 运行所有测试: pytest / npm test
□ 代码覆盖率 ≥ 80%
□ 无 linting 错误
□ 依赖 pip-audit / npm audit 通过
□ 代码审查（同行）
□ 更新文档和CHANGELOG
```

### 部署前检查
```
□ Security scan: bandit + semgrep
□ Dependency check: pip-audit + npm audit
□ Config validation: 环境变量检查
□ Database migration: 测试回滚
□ Smoke test: 基本功能验证
□ Performance baseline: 无性能下降
```

---

## 🔐 安全编码规范

### ❌ 禁止的操作

```python
# 不要硬编码密钥
SECRET_KEY = "my-secret-key"  # ❌

# 不要使用 eval() 或 exec()
result = eval(user_input)  # ❌

# 不要信任用户输入
file_path = "/uploads/" + filename  # ❌

# 不要使用全局异常处理
try:
    something()
except:  # ❌ 捕获所有异常
    pass

# 不要在日志中输出敏感信息
logger.info(f"User {username} logged in with password {password}")  # ❌

# 不要在前端存储token在localStorage
localStorage.setItem('token', token)  # ❌（容易XSS）

# 不要混合同步和异步
async def my_func():
    db = SessionLocal()  # ❌ 同步创建
    await db.execute(...)  # ❌ 异步执行
```

### ✅ 推荐的做法

```python
# 从环境变量读取密钥
SECRET_KEY = os.environ.get("SECRET_KEY")
assert SECRET_KEY, "SECRET_KEY not set"  # 验证存在

# 使用参数化查询
query = select(User).where(User.username == username)  # ✓ 参数化

# 验证和清理输入
from pydantic import BaseModel, Field
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=12)

# 使用特定的异常
try:
    result = await db.execute(query)
except NoResultFound:  # ✓ 特定异常
    raise HTTPException(404)

# 使用结构化日志
logger.info("user_login", username=username, ip=request.client.host)

# 在前端使用httpOnly cookie
response.set_cookie("token", token, httponly=True, secure=True)

# 一致的异步处理
async def my_func(db: AsyncSession = Depends(get_db)):  # ✓ 依赖注入
    result = await db.execute(query)
```

---

## 📊 优先级矩阵

```
高影响 ┌─────────────────────────────────────┐
       │ C1-C5  │          H1-H12              │
       │ CRITICAL      HIGH                   │
       │ (Week 1)      (Week 2)               │
       ├─────────────────────────────────────┤
       │          M1-M18                      │
       │          MEDIUM                      │
       │          (Week 3-4)                  │
       │                                      │
       │ L1-L14                               │
       │ LOW                                  │
低影响 │ (Week 5-10)                          │
       └──────────────────┬──────────────────┘
         低工作量         高工作量
```

---

## 📞 问题上报模板

当发现新问题时，使用以下模板：

```markdown
## 问题标题
[简短描述]

## 严重程度
- [ ] CRITICAL (立即修复)
- [ ] HIGH (本周修复)
- [ ] MEDIUM (本月修复)
- [ ] LOW (待办事项)

## 描述
[详细描述问题]

## 影响范围
- 文件: [相关文件]
- 函数: [相关函数]
- 用户: [影响的用户]

## 风险评估
[可能的后果]

## 建议修复
[修复方案]

## 验收标准
- [ ] 修复代码通过审查
- [ ] 测试覆盖率 ≥ 80%
- [ ] 不引入新的问题
```

---

## 🎓 学习资源

### 安全
- [OWASP Top 10 2023](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)

### 代码质量
- [Clean Code](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
- [Design Patterns](https://refactoring.guru/design-patterns)
- [Python Best Practices](https://pep8.org/)

### 测试
- [Testing Best Practices](https://testingjavascript.com/)
- [pytest Documentation](https://docs.pytest.org/)

---

**最后更新**: 2026-05-02  
**维护者**: AI Code Reviewer  
**版本**: 1.0
