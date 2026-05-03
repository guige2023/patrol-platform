# SearXNG 搜索 API 服务

> 基于 SearXNG 的聚合搜索 API，提供统一的搜索接口，支持多引擎并行搜索、结果去重、质量排序。

## 📌 项目信息

- **部署地址**: `http://180.76.188.63:8080`
- **文档版本**: 1.0
- **更新日期**: 2026-04-12

---

## 🔧 快速开始

### 基础调用

```bash
# 搜索测试
curl "http://180.76.188.63:8080/search?q=python&format=json&limit=5"

# 指定引擎搜索
curl "http://180.76.188.63:8080/search?q=python&format=json&engines=github,stackoverflow&limit=10"
```

### Python 调用

```python
import requests

def search(query, engines=None, limit=10):
    params = {"q": query, "format": "json", "limit": limit}
    if engines:
        params["engines"] = ",".join(engines) if isinstance(engines, list) else engines
    resp = requests.get("http://180.76.188.63:8080/search", params=params, timeout=10)
    return resp.json()

# 搜索所有可用引擎
results = search("机器学习")

# 指定引擎
results = search("javascript", engines=["github", "stackoverflow", "mdn"])
```

---

## 🔍 可用引擎 (13个)

| 引擎 | 快捷键 | 类型 | 说明 |
|------|--------|------|------|
| `bing` | `bi` | 通用 | 必应搜索，中文结果丰富 |
| `github` | `gh` | 代码 | GitHub 代码仓库搜索 |
| `stackoverflow` | `so` | 问答 | 程序员问答 |
| `sogou` | - | 通用 | 搜狗搜索，中文优化 |
| `mdn` | `mdn` | 文档 | Mozilla Web 开发文档 |
| `superuser` | - | 问答 | 系统管理员问答 |
| `askubuntu` | - | 问答 | Ubuntu 问答社区 |
| `artic` | `arc` | 学术 | 学术文章索引 |
| `devicons` | `di` | 工具 | 开发图标搜索 |
| `mankier` | `man` | 手册 | Linux 命令手册 |
| `photon` | - | 地图 | OpenStreetMap 图片 |
| `piratebay` | - | 种子 | 种子文件搜索 |
| `sepiasearch` | - | 元搜索 | 元搜索引擎聚合 |

---

## 📡 API 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | ✅ | - | 搜索关键词，支持中文 |
| `format` | string | ❌ | `html` | 输出格式：`json` / `html` / `csv` / `rss` |
| `limit` | integer | ❌ | 10 | 返回结果数量，范围 1-100 |
| `engines` | string | ❌ | 全部 | 指定引擎，逗号分隔 |
| `lang` | string | ❌ | `auto` | 语言过滤 |
| `safesearch` | integer | ❌ | 0 | 安全搜索：0=关闭 / 1=适中 / 2=严格 |
| `time_range` | string | ❌ | - | 时间范围：`day` / `week` / `month` / `year` |

---

## 📁 项目结构

```
searxng-mcp-server/
├── API.md                    # API 完整文档
├── ENGINE_STATUS.md          # 引擎状态报告
├── README.md                 # 本文件
├── server.py                 # HTTP/SSE 模式主服务器
├── mcp_stdio_server.py       # STDIO 模式主服务器
├── plugin_manager.py          # 插件管理系统
├── enhanced_crawler.py        # 增强爬虫
├── docker-manager.js          # Docker 生命周期管理
├── searxng-settings.yml      # SearXNG 引擎配置
├── requirements.txt          # Python 依赖
├── SECURITY_FIXES.md         # 安全修复说明
└── utils/                    # 工具模块
    ├── security.py           # 安全工具
    ├── validators.py         # 验证工具
    └── response.py           # 响应处理
```

---

## 🚀 部署

### 服务器部署 (Docker)

```bash
# 1. 拉取镜像
docker pull searxng/searxng:latest

# 2. 创建配置目录
mkdir -p /opt/searxng

# 3. 启动容器
docker run -d \
  --name searxng \
  -p 8080:8080 \
  -v /opt/searxng:/etc/searxng \
  --restart unless-stopped \
  searxng/searxng:latest

# 4. 修改配置（上传 searxng-settings.yml）
# 5. 重启容器
docker restart searxng
```

### 本地开发

```bash
# 1. 克隆项目
git clone <repo-url> searxng-mcp-server
cd searxng-mcp-server

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动服务
python server.py
```

---

## 📊 响应格式

```json
{
  "query": "python",
  "number_of_results": 10,
  "results": [
    {
      "url": "https://stackoverflow.com/questions/...",
      "title": "问题标题",
      "content": "问题摘要",
      "engine": "stackoverflow",
      "score": 1.0,
      "category": "it"
    }
  ],
  "answers": [],
  "corrections": [],
  "infoboxes": [],
  "suggestions": [],
  "unresponsive_engines": []
}
```

---

## ⚠️ 已知问题

- `number_of_results` 字段部分引擎不返回，但 `results` 数组有数据
- `github` 引擎有时响应较慢（5-8秒），建议设置较长超时

---

## 📝 更新日志

| 日期 | 操作 |
|------|------|
| 2026-04-12 | 完成 95 个引擎测试，禁用 82 个无效引擎，保留 13 个可用引擎 |
| 2026-04-12 | 初始部署到百度云服务器 |

---

## 📄 许可证

MIT License
