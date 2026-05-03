# SearXNG 搜索 API 文档

> **部署地址**: `http://180.76.188.63:8080`
> **文档版本**: 1.0
> **更新日期**: 2026-04-12

---

## 一、概述

SearXNG 是一个开源的元搜索引擎，聚合多个搜索引擎的结果。本 API 提供统一的搜索接口，支持多引擎并行搜索、结果去重、质量排序。

### 核心能力

- **多引擎并行**: 13个可用引擎一次查询
- **跨引擎聚合**: 自动去重、排序
- **多格式输出**: JSON / HTML / RSS / CSV
- **分类搜索**: IT、新闻、图片、视频、学术等
- **零成本**: 无需 Google/Bing API 密钥

---

## 二、快速开始

### 基础调用

```bash
curl "http://180.76.188.63:8080/search?q=python&format=json&limit=5"
```

### Python 调用示例

```python
import requests

def search(query, engines=None, limit=10):
    params = {
        "q": query,
        "format": "json",
        "limit": limit,
    }
    if engines:
        params["engines"] = ",".join(engines) if isinstance(engines, list) else engines
    
    resp = requests.get("http://180.76.188.63:8080/search", params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()

# 搜索所有可用引擎
results = search("机器学习")

# 指定引擎
results = search("javascript", engines=["github", "stackoverflow", "mdn"])

# 单引擎搜索
results = search("python", engines="stackoverflow")
```

---

## 三、API 端点

### 3.1 搜索接口

**端点**: `GET /search`

**基础 URL**: `http://180.76.188.63:8080/search`

---

### 3.2 路径参数

无路径参数。

---

### 3.3 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | ✅ | - | 搜索关键词，支持中文 |
| `format` | string | ❌ | `html` | 输出格式：`json` / `html` / `csv` / `rss` |
| `limit` | integer | ❌ | 10 | 返回结果数量，范围 1-100 |
| `engines` | string | ❌ | 全部 | 指定引擎，逗号分隔，如 `github,stackoverflow,mdn` |
| `categories` | string | ❌ | `general` | 搜索分类：`general` / `it` / `science` / `news` / `images` / `videos` / `music` |
| `lang` | string | ❌ | `auto` | 语言过滤：`en` / `zh` / `ja` / `auto` |
| `safesearch` | integer | ❌ | 0 | 安全搜索：0=关闭 / 1=适中 / 2=严格 |
| `time_range` | string | ❌ | - | 时间范围：`day` / `week` / `month` / `year` |
| `page` | integer | ❌ | 1 | 分页页码 |

---

### 3.4 可用引擎列表

| 引擎名称 | 快捷键 | 类型 | 说明 |
|----------|--------|------|------|
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

## 四、响应格式

### 4.1 JSON 响应结构

```json
{
  "query": "python",
  "number_of_results": 10,
  "results": [
    {
      "url": "https://stackoverflow.com/questions/...",
      "title": "问题标题",
      "content": "问题摘要内容，包含标签和分数",
      "engine": "stackoverflow",
      "template": "default.html",
      "parsed_url": ["https", "stackoverflow.com", "/q/123", "", "", ""],
      "img_src": "",
      "thumbnail": "",
      "engines": ["stackoverflow"],
      "positions": [1],
      "score": 1.0,
      "category": "it",
      "publishedDate": null
    }
  ],
  "answers": [],
  "corrections": [],
  "infoboxes": [],
  "suggestions": [],
  "unresponsive_engines": []
}
```

### 4.2 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `query` | string | 原始查询词 |
| `number_of_results` | integer | 返回结果总数（部分引擎不返回此值） |
| `results` | array | 结果数组，每项见下表 |
| `answers` | array | 直接回答（如计算器结果） |
| `corrections` | array | 拼写纠正建议 |
| `infoboxes` | array | 知识卡片（Wikipedia等） |
| `suggestions` | array | 搜索建议词 |
| `unresponsive_engines` | array | 超时/失败的引擎列表 `[["引擎名", "原因"]]` |

### 4.3 单个结果字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | 结果链接 |
| `title` | string | 结果标题 |
| `content` | string | 结果摘要/正文 |
| `engine` | string | 来源引擎 |
| `template` | string | 渲染模板类型 |
| `parsed_url` | array | URL 解析结果 `[scheme, netloc, path, params, query, fragment]` |
| `engines` | array | 实际返回结果的引擎列表 |
| `positions` | array | 在各引擎中的排名位置 |
| `score` | float | 相关性分数 |
| `category` | string | 内容分类 |
| `publishedDate` | string/null | 发布日期（部分引擎支持） |
| `img_src` | string | 主图 URL（图片类引擎） |
| `thumbnail` | string | 缩略图 URL |

---

## 五、引擎特定调用

### 5.1 GitHub 代码搜索

```bash
# 搜索 Python 相关 GitHub 仓库
curl "http://180.76.188.63:8080/search?q=python&format=json&engines=github&limit=10"

# 搜索结果示例
{
  "results": [
    {
      "title": "vinta/awesome-python",
      "url": "https://github.com/vinta/awesome-python",
      "content": "Awesome Python ... stars: 123k",
      "engine": "github"
    }
  ]
}
```

### 5.2 StackOverflow 问答搜索

```bash
curl "http://180.76.188.63:8080/search?q=python+dict+iterate&format=json&engines=stackoverflow&limit=5"
```

### 5.3 MDN Web 文档搜索

```bash
# 搜索 JavaScript API 文档
curl "http://180.76.188.63:8080/search?q=javascript+fetch&format=json&engines=mdn&limit=5"
```

### 5.4 多引擎组合搜索

```bash
# 同时搜索代码+问答+文档
curl "http://180.76.188.63:8080/search?q=python+async&format=json&engines=github,stackoverflow,mdn&limit=15"
```

### 5.5 中文搜索（推荐引擎）

```bash
# 使用搜狗引擎搜索中文内容
curl "http://180.76.188.63:8080/search?q=人工智能&format=json&engines=sogou&limit=10"

# 使用必应引擎搜索中文
curl "http://180.76.188.63:8080/search?q=人工智能&format=json&engines=bing&limit=10"
```

---

## 六、错误处理

### 6.1 常见错误

| HTTP 状态码 | 说明 | 处理方式 |
|-------------|------|----------|
| 200 | 成功 | 解析 `results` 数组 |
| 400 | 请求参数错误 | 检查 `q` 参数是否为空 |
| 429 | 请求过于频繁 | 降低请求频率 |
| 500 | 服务器内部错误 | 稍后重试 |

### 6.2 引擎级错误

即使部分引擎失败，API 仍会返回其他引擎的结果。通过检查 `unresponsive_engines` 字段识别：

```json
{
  "results": [...],
  "unresponsive_engines": [
    ["github", "timeout"]
  ]
}
```

常见错误类型：
- `timeout` - 引擎响应超时
- `access denied` - 访问被拒绝（CAPTCHA/IP限制）
- `Suspended: timeout` - 引擎被临时禁用
- `parsing error` - 响应解析失败

---

## 七、调用限制

| 限制项 | 值 | 说明 |
|--------|-----|------|
| 单次请求超时 | 10秒 | 建议客户端设置超时 |
| 请求频率 | 建议<5 req/s | 无硬性限制，但频繁请求会导致部分引擎超时 |
| 单次最大结果 | 100条 | `limit` 参数最大值 |
| 支持引擎数 | 13个 | 详见引擎列表 |

---

## 八、使用示例

### 8.1 Node.js 调用

```javascript
async function search(query, engines = []) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
  });
  if (engines.length) params.set('engines', engines.join(','));
  
  const resp = await fetch(`http://180.76.188.63:8080/search?${params}`);
  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  return resp.json();
}

// 使用
const results = await search('python', ['github', 'stackoverflow']);
console.log(results.results.map(r => ({ title: r.title, url: r.url })));
```

### 8.2 Python 异步调用

```python
import aiohttp

async def search_async(query, engines=None, limit=10):
    params = {"q": query, "format": "json", "limit": limit}
    if engines:
        params["engines"] = ",".join(engines)
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "http://180.76.188.63:8080/search",
            params=params,
            timeout=aiohttp.ClientTimeout(total=10)
        ) as resp:
            return await resp.json()
```

### 8.3 定时任务批量搜索

```python
import schedule, time
from datetime import datetime

TRACKED_KEYWORDS = [
    "人形机器人",
    "humanoid robot",
    "Optimus Tesla",
    "大模型",
]

def daily_search():
    print(f"[{datetime.now()}] Starting daily search...")
    for keyword in TRACKED_KEYWORDS:
        result = search(keyword, engines=["sogou", "bing"], limit=20)
        print(f"  {keyword}: {len(result['results'])} results")
        # TODO: 存入数据库 / 发送通知

schedule.every().day.at("08:00").do(daily_search)

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## 九、配置更新日志

| 日期 | 操作 | 说明 |
|------|------|------|
| 2026-04-12 | 禁用 82 个无效引擎 | 保留 13 个可用引擎 |
| 2026-04-12 | 初始部署 | 百度云 `180.76.188.63:8080` |

### 当前可用引擎 (13个)
bing, github, stackoverflow, sogou, mdn, superuser, askubuntu, artic, devicons, mankier, photon, piratebay, sepiasearch

### 已禁用原因分类
- **超时**: google, duckduckgo, wikipedia, baidu(CAPTCHA), wikidata, arxiv, bandcamp, flickr, youtube, vimeo 等
- **访问拒绝**: pexels, karmasearch, aol 等
- **解析错误**: bing images/news/videos, qwant全系, lemmy全系 等

---

## 十、联系方式

如有问题，请联系维护者或提交 Issue。
