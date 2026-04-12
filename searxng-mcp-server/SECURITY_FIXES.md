# SearXNG MCP Server v2.0 - 安全修复报告

## 🔴 已修复的关键漏洞

### 1. SSRF (服务器端请求伪造) - CVE-2024-XXXX

**位置**: `enhanced_crawler.py:88`

**漏洞描述**:
原代码直接接受任意 URL，可以访问内部网络资源：
```python
# 漏洞代码
async def fetch_webpage(self, url: str, max_length: int = 10000):
    response = await client.get(url)  # 无验证！
```

**攻击示例**:
```bash
# 攻击者可以访问 AWS 元数据
curl -X POST http://localhost:3001/mcp \
  -d '{"method":"tools/call","params":{"name":"crawl","arguments":{"url":"http://169.254.169.254/latest/meta-data/"}}}'
```

**修复措施**:
- 实现 `URLValidator` 类验证所有 URL
- 阻止访问私有 IP 网络（10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 等）
- 阻止访问云元数据端点（169.254.169.254, metadata.google.internal）
- 只允许 http/https 协议
- 阻止访问特权端口（22, 23, 25, 3306 等）

```python
# 修复后代码
async def fetch_webpage(self, url: str, max_length: int = 10000):
    is_valid, error = self.url_validator.validate(url)
    if not is_valid:
        raise SecurityError(f"不安全的 URL: {error}")
    response = await client.get(url)
```

### 2. 任意代码执行 - CVE-2024-XXXX

**位置**: `plugin_manager.py:34`

**漏洞描述**:
原代码使用 `exec_module()` 直接执行插件代码，没有沙箱：
```python
# 漏洞代码
spec.loader.exec_module(module)  # 执行任意 Python 代码！
```

**攻击示例**:
```python
# 恶意插件示例 (plugins/evil.py)
import os
os.system("rm -rf /")  # 可以执行任意系统命令
```

**修复措施**:
- 实现 AST 静态分析检查危险代码
- 禁止调用 `eval`, `exec`, `__import__`, `open` 等危险函数
- 模块导入白名单机制
- 受限的 `__builtins__` 命名空间
- 执行时间限制

```python
# 修复后代码 - AST 分析
is_safe, error = self._analyze_ast(code, filename)
if not is_safe:
    return False, f"安全分析失败: {error}"

# 受限执行环境
restricted_globals = self._create_restricted_globals(manifest)
exec(compiled, restricted_globals)
```

### 3. 命令注入

**位置**: `docker-manager.js:114`

**漏洞描述**:
原代码直接将用户输入拼接到 shell 命令：
```javascript
// 漏洞代码
execSync(`docker ps --filter name=^${containerName}$...`)  // 命令注入！
```

**攻击示例**:
```javascript
containerName = "test; rm -rf /";  // 注入恶意命令
```

**修复措施**:
- 输入净化函数 `sanitizeContainerName()`
- 白名单验证（只允许字母、数字、下划线、点和横线）
- 危险字符检查
- 使用安全的命令构建方式

```javascript
// 修复后代码
function sanitizeContainerName(name) {
    if (CONFIG.DANGEROUS_CHARS.test(name)) {
        throw new SecurityError('容器名包含非法字符');
    }
    if (!CONFIG.SAFE_CHARS_REGEX.test(name)) {
        throw new SecurityError('容器名格式无效');
    }
    return name;
}
```

## 🛡️ 新增的安全功能

### 1. 统一的安全工具模块

```
utils/
├── security.py    # URL 验证、SSRF 防护、输入净化
├── validators.py  # 参数验证
└── response.py    # 标准化响应格式
```

### 2. 输入验证系统

所有工具参数都经过严格验证：

```python
# 搜索工具验证
valid, error, sanitized = validate_search_args(arguments)
if not valid:
    return ResponseFormatter.validation_error(error, "search")

# 爬取工具验证
valid, error, sanitized = validate_crawl_args(arguments)
if not valid:
    return ResponseFormatter.validation_error(error, "crawl")
```

### 3. 标准化错误处理

```json
{
  "success": false,
  "code": "SECURITY_ERROR",
  "message": "禁止访问的 URL",
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "a1b2c3d4",
    "tool": "crawl"
  }
}
```

## 🤖 AI Agent 兼容性改进

### 1. 标准化 JSON 响应

所有响应都遵循统一格式：
```json
{
  "success": true|false,
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "data": { ... },
  "metadata": {
    "timestamp": "...",
    "request_id": "...",
    "tool": "...",
    "duration_ms": 1234
  }
}
```

### 2. 健康检查端点

- HTTP GET `/health`
- MCP 工具 `health`
- 返回服务状态和依赖健康度

### 3. 错误码系统

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| SUCCESS | 成功 | 200 |
| VALIDATION_ERROR | 参数验证失败 | 400 |
| SECURITY_ERROR | 安全错误 | 403 |
| NETWORK_ERROR | 网络错误 | 502 |
| INTERNAL_ERROR | 内部错误 | 500 |

### 4. 工具能力发现

完整的 MCP 协议支持：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "result": {
    "tools": [
      {
        "name": "search",
        "description": "...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

## 📊 安全测试结果

```
运行测试: 23
成功: 23
失败: 0
错误: 0

✅ 所有测试通过！
```

### 测试覆盖

1. **SSRF 防护** (6 项测试)
   - 阻止私有 IP
   - 阻止元数据端点
   - 阻止危险协议
   - 阻止特权端口
   - 阻止路径遍历

2. **输入验证** (8 项测试)
   - 参数必需性检查
   - 长度限制
   - 数值范围
   - 格式验证

3. **响应格式化** (3 项测试)
   - 成功响应
   - 错误响应
   - 验证错误

4. **输入净化** (3 项测试)
   - 控制字符移除
   - 长度限制
   - 类型转换

5. **插件安全** (3 项测试)
   - AST 分析阻止 eval
   - AST 分析阻止危险导入
   - 允许安全导入

## 🚀 部署建议

### 1. 环境变量配置

```bash
# 复制环境配置
cp .env.example .env

# 编辑 .env，确保以下设置：
ALLOW_PRIVATE_IPS=false      # 生产环境禁止访问私有 IP
MAX_QUERY_LENGTH=500         # 限制查询长度
MAX_RESULTS=50              # 限制结果数量
```

### 2. Docker 安全

```bash
# 启动时自动应用安全限制
node docker-manager.js start
# - CPU 限制: 1核
# - 内存限制: 512MB
# - 重启策略: unless-stopped
```

### 3. 网络隔离

```bash
# 建议使用 Docker 网络隔离
docker network create --internal searxng-network
```

## 📝 版本信息

- **版本**: 2.0.0
- **发布日期**: 2024-01-15
- **兼容性**: MCP Protocol 2024-11-05
- **Python**: >= 3.9

## 🔗 相关链接

- [MCP Protocol](https://modelcontextprotocol.io/)
- [SearXNG](https://github.com/searxng/searxng)
- [OWASP SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)