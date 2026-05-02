# 代码审查修复执行计划

**项目**: 巡察工作管理平台  
**创建日期**: 2026-05-02  
**预计完成**: 10周

---

## 📅 修复时间表

### 第1周: 紧急安全修复

#### Day 1-2: C1 权限检查修复
```python
# 文件: backend/app/dependencies.py
# 问题: 异步函数中使用同步session创建

# ✗ 当前代码
async def check_permission(user: User, *required_permissions: str) -> User:
    from app.database import AsyncSessionLocal
    db = AsyncSessionLocal()  # 错误！
    try:
        role_result = await db.execute(...)

# ✓ 修复方案
async def check_permission(
    user: User, 
    db: AsyncSession = Depends(get_db),
    *required_permissions: str
) -> User:
    # 通过依赖注入获取session
    role_result = await db.execute(
        select(Role).where(Role.code == user.role)
    )
    # ...

# 测试用例
@pytest.mark.asyncio
async def test_check_permission_with_valid_role():
    # 验证权限检查正常工作
    pass
```

**工作量**: 4小时  
**风险**: 权限检查可能暂时失效，需要快速部署  
**验收标准**: 所有权限检查测试通过

---

#### Day 2-3: C2 CSRF保护实现
```bash
# 安装依赖
pip install fastapi-csrf-protect

# 配置文件: backend/app/main.py
from fastapi_csrf_protect import CsrfProtect

@CsrfProtect.load_config
async def get_config():
    return CsrfSettings(secret="your-secret-key")

# 为所有修改操作添加CSRF保护
@router.post("/users")
@CsrfProtect.protected()
async def create_user(...):
    pass
```

**工作量**: 6小时  
**影响**: 前端需要在请求头中携带CSRF token  
**验收标准**: POST/PUT/DELETE请求需要有效的CSRF token

---

#### Day 3-4: C3 Docker密码安全
```yaml
# docker-compose.yml 修复

# ✗ 旧方式
environment:
  - POSTGRES_PASSWORD=${PATROL_DB_PASSWORD}

# ✓ 新方式1: 使用.env文件（推荐）
env_file:
  - .env
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

# ✓ 新方式2: 使用Docker secrets（更安全）
secrets:
  db_password:
    file: ./secrets/db_password

services:
  db:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
```

**工作量**: 3小时  
**影响**: 需要重新启动容器，创建secrets目录  
**验收标准**: `docker-compose logs` 中不出现密码

---

#### Day 4-5: C4 加密密钥派生修复
```python
# 文件: backend/app/core/encryption.py

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
import base64
import os

def _get_cipher():
    # ✗ 旧方式（不安全）
    # key = hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
    
    # ✓ 新方式（使用PBKDF2）
    # 每个用户使用不同的salt（存储在数据库中）
    # 但对于字段加密，可以使用固定salt（如果接受的话）
    
    # 方案A: 使用Fernet的内置密钥生成
    from cryptography.fernet import Fernet
    # 从密钥派生Fernet密钥
    key_material = settings.ENCRYPTION_KEY.encode()
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'fixed-salt',  # ⚠️ TODO: 考虑使用用户特定的salt
        iterations=100000,
        backend=default_backend(),
    )
    key = base64.urlsafe_b64encode(kdf.derive(key_material))
    return Fernet(key)

def encrypt_field(value: str) -> str:
    if not value:
        return value
    cipher = _get_cipher()
    encrypted = cipher.encrypt(value.encode())
    return base64.b64encode(encrypted).decode()

def decrypt_field(encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    cipher = _get_cipher()
    decrypted = cipher.decrypt(base64.b64decode(encrypted_value.encode()))
    return decrypted.decode()
```

**工作量**: 5小时（包括测试）  
**风险**: 加密的现有数据需要重新加密  
**迁移步骤**:
```python
# 创建迁移脚本
async def migrate_encrypted_fields():
    """迁移现有的加密字段到新的加密方式"""
    async with AsyncSessionLocal() as db:
        users = await db.execute(select(User))
        for user in users.scalars():
            if user.id_card_encrypted:
                # 用旧方式解密
                old_cipher = old_get_cipher()
                decrypted = old_cipher.decrypt(user.id_card_encrypted.encode())
                # 用新方式加密
                user.id_card_encrypted = encrypt_field(decrypted.decode())
        await db.commit()
```

---

#### Day 5: C5 路径遍历漏洞修复
```python
# 文件: backend/app/api/v1/knowledge_files.py

import pathlib

@router.get("/{knowledge_id}/{filename}/preview")
async def preview_attachment(
    knowledge_id: UUID,
    filename: str,
    uow: UnitOfWork = Depends(get_uow),
    current_user: User = Depends(get_current_user),
):
    # 验证文件名
    try:
        safe_filename = pathlib.Path(filename)
        # 检查是否为绝对路径
        if safe_filename.is_absolute():
            raise HTTPException(status_code=400, detail="Invalid filename")
        # 检查是否包含..
        if ".." in safe_filename.parts:
            raise HTTPException(status_code=400, detail="Invalid filename")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # 从数据库查询attachment，不直接使用filename
    result = await uow.execute(
        select(Attachment).where(
            Attachment.id == UUID(filename),  # 假设filename是UUID
            Attachment.knowledge_id == knowledge_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # 权限检查
    await check_permission(current_user, "knowledge:read")
    
    # 返回文件
    file_path = pathlib.Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        file_path,
        filename=attachment.file_name,
        media_type=attachment.mime_type
    )
```

**工作量**: 4小时  
**验收标准**: 无法访问 `../../../etc/passwd` 等路径

---

### 第2周: 高优先级修复

#### H1-H4: 权限和加密相关
- 统一权限实现 (4小时)
- 审计日志flush修复 (2小时)
- 文件访问控制改进 (6小时)

#### H5-H8: 安全加固
- 实现速率限制 (4小时)
- 配置数据库连接池 (2小时)
- 改进密码验证错误消息 (2小时)
- 实现结构化日志 (6小时)

#### H9-H12: 输入验证和HTTP安全
- 移除print语句 (3小时)
- 添加文件大小限制 (2小时)
- 实现密钥轮换 (4小时)
- 实现暴力破解防御 (6小时)
- 添加安全HTTP头 (2小时)

---

### 第3-4周: 中等优先级修复

#### M1-M6: 检测和验证
- SQL注入检测工具 (2小时)
- 权限模型统一 (8小时)
- API版本控制 (6小时)
- 环境配置验证 (4小时)
- OpenAPI安全配置 (2小时)
- 数据库迁移验证 (4小时)

#### M7-M12: 操作和前端安全
- 敏感操作二次确认 (6小时)
- 分页边界检查 (2小时)
- 字段级加密 (8小时)
- 数据脱敏 (6小时)
- 使用httpOnly cookie (6小时)
- 实现CSP (4小时)

#### M13-M18: 错误处理和依赖
- SRI支持 (2小时)
- 统一错误消息 (4小时)
- 数据验证一致性 (6小时)
- 依赖版本锁定 (2小时)
- 依赖漏洞扫描 (4小时)
- 前端Error Boundary (4小时)

---

### 第5-10周: 低优先级和测试

#### L1-L14: 代码质量
- 替换print为日志 (4小时)
- 添加type hints (8小时)
- 分解长函数 (12小时)
- 编写单元测试 (40小时)
- 前端错误重试 (6小时)
- 日志级别配置 (4小时)
- 提取魔数 (4小时)
- 性能监控集成 (8小时)
- 数据库查询优化 (12小时)
- 速率限制配置 (4小时)
- 前端库升级 (6小时)
- 国际化支持 (16小时)
- API文档规范 (6小时)
- 数据导出验证 (4小时)

---

## 🧪 测试策略

### 单元测试
```python
# 示例: test_security.py
import pytest
from app.core.security import verify_password, get_password_hash, create_access_token

class TestSecurity:
    def test_password_hash_different_from_input(self):
        password = "test_password_123"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)
    
    def test_password_verify_fails_with_wrong_password(self):
        password = "test_password_123"
        hashed = get_password_hash(password)
        assert not verify_password("wrong_password", hashed)
    
    @pytest.mark.asyncio
    async def test_create_access_token(self):
        token = create_access_token({"sub": "user123"})
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_encryption_decryption(self):
        from app.core.encryption import encrypt_field, decrypt_field
        original = "sensitive_data"
        encrypted = encrypt_field(original)
        assert encrypted != original
        decrypted = decrypt_field(encrypted)
        assert decrypted == original

# 运行
pytest backend/tests/test_security.py -v --cov=app.core.security
```

### 集成测试
```python
# 示例: test_auth_integration.py
@pytest.mark.asyncio
async def test_login_flow(client: AsyncClient):
    # 登录
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "correct_password"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    
    # 使用token访问受保护资源
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_login_with_wrong_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong_password"}
    )
    assert response.status_code == 401
    # 错误消息应该通用，不说明密码错误还是用户不存在
    assert "Invalid" in response.json()["detail"]

@pytest.mark.asyncio
async def test_csrf_protection(client: AsyncClient):
    # 无CSRF token的POST应该失败
    response = await client.post(
        "/api/v1/users",
        json={"username": "test", "password": "test", "email": "test@example.com"},
    )
    assert response.status_code == 403  # Forbidden

    # 有CSRF token的POST应该成功（假设认证通过）
    # ... csrf token获取逻辑
```

### 安全测试
```bash
# 漏洞扫描
pip install bandit
bandit -r backend/app -ll

# SQL注入测试
pip install sqlmap
sqlmap -u "http://localhost:8000/api/v1/users?name=test" --batch

# XSS测试
# 尝试上传 <script>alert('xss')</script> 到任何文本字段

# CSRF测试
# 从不同域发送POST请求，应该被拒绝
```

---

## 📊 修复进度追踪

### 检查清单

- [ ] **CRITICAL Issues (Week 1)**
  - [ ] C1: 权限检查异步修复
  - [ ] C2: CSRF保护实现
  - [ ] C3: Docker密码安全
  - [ ] C4: 加密密钥派生
  - [ ] C5: 路径遍历修复
  - [ ] 进行安全审计
  - [ ] 更新依赖

- [ ] **HIGH Issues (Week 2)**
  - [ ] H1-H12: 按优先级修复
  - [ ] 编写安全相关测试
  - [ ] 代码审查

- [ ] **MEDIUM Issues (Week 3-4)**
  - [ ] M1-M18: 按优先级修复
  - [ ] 代码重构
  - [ ] 单元测试编写

- [ ] **LOW Issues (Week 5-10)**
  - [ ] L1-L14: 代码质量改进
  - [ ] 性能优化
  - [ ] 文档完善

---

## 🔒 安全验收标准

所有修复完成后，必须满足以下标准：

### 黑盒测试
- [ ] Burp Suite 扫描无High以上漏洞
- [ ] OWASP ZAP 扫描通过
- [ ] 手工渗透测试通过

### 代码审查
- [ ] SAST工具(Semgrep/Bandit)无发现
- [ ] 至少两名开发人员审查
- [ ] 所有Comments解决

### 测试覆盖
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 安全关键代码100%覆盖
- [ ] 集成测试通过率100%

### 部署前检查
- [ ] 依赖审计通过（无已知漏洞）
- [ ] 配置验证通过
- [ ] 文档更新完成

---

## 👥 团队分工建议

**假设3人团队：**

| 成员 | 职责 | 工作量 |
|------|------|--------|
| 开发1 (Lead) | CRITICAL修复 + 安全审查 | 40小时 |
| 开发2 | HIGH修复 + 测试编写 | 50小时 |
| 开发3 | MEDIUM/LOW修复 + 文档 | 45小时 |

**每周检查点:**
- Monday: 周计划会议 (1小时)
- Wednesday: 进度检查 (30分钟)
- Friday: 代码审查和演示 (2小时)

---

## 📚 相关文档

- [FastAPI Security Docs](https://fastapi.tiangolo.com/tutorial/security/)
- [OWASP Top 10 2023](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

**创建者**: AI Code Reviewer  
**最后更新**: 2026-05-02
