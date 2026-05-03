"""
SearXNG MCP 服务器 - 安全的搜索和爬虫服务

安全特性：
- SSRF 防护
- 输入验证
- 标准化响应格式
- 健康检查端点
- 速率限制

AI 友好特性：
- 结构化 JSON 响应
- 标准化错误码
- 请求追踪 ID
- 工具能力发现
"""

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Set, AsyncGenerator

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 导入安全模块
from utils.security import SecurityError, URLValidator
from utils.validators import (
    validate_search_args, validate_crawl_args, validate_health_args,
    ValidationError
)
from utils.response import APIResponse, ResponseCode, ResponseFormatter
from enhanced_crawler import EnhancedWebCrawler
from plugin_manager import PluginManager, PluginSecurityError

# 全局状态
class AppState:
    """应用状态"""
    def __init__(self):
        self.crawler: Optional[EnhancedWebCrawler] = None
        self.plugin_manager: Optional[PluginManager] = None
        self.api_response = APIResponse()
        self.version = "2.0.0"
        self.started_at = time.time()
        self.request_count = 0
        self.error_count = 0

app_state = AppState()

# ============ 配置 ============

SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")
PLUGINS_DIR = os.getenv("PLUGINS_DIR", "plugins")
ALLOW_PRIVATE_IPS = os.getenv("ALLOW_PRIVATE_IPS", "").lower() in ('true', '1', 'yes')
MAX_QUERY_LENGTH = int(os.getenv("MAX_QUERY_LENGTH", "500"))
MAX_RESULTS = int(os.getenv("MAX_RESULTS", "50"))

# ============ MCP 工具定义 ============

SEARCH_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "搜索查询词",
            "minLength": 1,
            "maxLength": MAX_QUERY_LENGTH
        },
        "engines": {
            "type": "string",
            "description": "搜索引擎列表，逗号分隔（如: google,bing,duckduckgo）",
            "default": ""
        },
        "language": {
            "type": "string",
            "description": "语言代码，如: zh-CN, en-US",
            "default": "zh-CN",
            "pattern": "^[a-z]{2}(-[A-Z]{2})?$"
        },
        "num_results": {
            "type": "integer",
            "description": "返回结果数量",
            "minimum": 1,
            "maximum": MAX_RESULTS,
            "default": 10
        },
        "safe_search": {
            "type": "integer",
            "description": "安全搜索级别: 0=关闭, 1=中等, 2=严格",
            "minimum": 0,
            "maximum": 2,
            "default": 1
        }
    },
    "required": ["query"]
}

CRAWL_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "url": {
            "type": "string",
            "description": "要爬取的网页 URL",
            "minLength": 5,
            "maxLength": 2000
        },
        "max_length": {
            "type": "integer",
            "description": "最大内容长度",
            "minimum": 100,
            "maximum": 100000,
            "default": 10000
        },
        "extract_links": {
            "type": "boolean",
            "description": "是否提取页面链接",
            "default": False
        },
        "timeout": {
            "type": "integer",
            "description": "请求超时时间（秒）",
            "minimum": 1,
            "maximum": 60,
            "default": 30
        }
    },
    "required": ["url"]
}

HEALTH_TOOL_SCHEMA = {
    "type": "object",
    "properties": {},
    "description": "检查服务健康状态"
}

MCP_TOOLS = [
    {
        "name": "search",
        "description": "使用 SearXNG 搜索网络。支持多引擎、语言筛选和安全搜索选项。",
        "inputSchema": SEARCH_TOOL_SCHEMA
    },
    {
        "name": "crawl",
        "description": "爬取指定 URL 的网页内容。自动提取正文、标题和可选的链接列表。",
        "inputSchema": CRAWL_TOOL_SCHEMA
    },
    {
        "name": "health",
        "description": "检查 MCP 服务器和相关服务的健康状态。",
        "inputSchema": HEALTH_TOOL_SCHEMA
    }
]

# ============ 生命周期管理 ============

@asynccontextmanager
async def lifespan(app: Starlette):
    """应用生命周期管理"""
    # 启动
    logger.info(f"正在启动 SearXNG MCP Server v{app_state.version}...")
    logger.info(f"SearXNG URL: {SEARXNG_URL}")
    logger.info(f"允许私有 IP: {ALLOW_PRIVATE_IPS}")
    
    # 初始化爬虫
    try:
        app_state.crawler = EnhancedWebCrawler(
            searxng_url=SEARXNG_URL,
            allow_private=ALLOW_PRIVATE_IPS
        )
        logger.info("爬虫初始化成功")
    except SecurityError as e:
        logger.error(f"爬虫初始化失败: {e}")
        raise
    
    # 初始化插件管理器
    app_state.plugin_manager = PluginManager(plugins_dir=PLUGINS_DIR)
    loaded, errors = app_state.plugin_manager.load_plugins()
    logger.info(f"插件加载完成: {loaded} 个成功, {len(errors)} 个失败")
    for error in errors:
        logger.warning(f"插件错误: {error}")
    
    yield
    
    # 关闭
    logger.info("正在关闭服务器...")
    if app_state.crawler:
        await app_state.crawler.close()

# ============ 健康检查 ============

async def health_check(request: Request) -> JSONResponse:
    """健康检查端点"""
    services = {
        "mcp_server": True,
        "crawler": app_state.crawler is not None,
    }
    
    # 检查 SearXNG 连接
    searxng_healthy = False
    if app_state.crawler:
        try:
            # 尝试一个简单的搜索来验证连接
            import httpx
            response = await app_state.crawler.client.get(
                f"{SEARXNG_URL}/",
                timeout=5
            )
            searxng_healthy = response.status_code == 200
        except Exception:
            pass
    
    services["searxng"] = searxng_healthy
    
    healthy = all(services.values())
    
    health_data = {
        "status": "healthy" if healthy else "degraded",
        "version": app_state.version,
        "uptime_seconds": int(time.time() - app_state.started_at),
        "request_count": app_state.request_count,
        "error_count": app_state.error_count,
        "services": services
    }
    
    status_code = 200 if healthy else 503
    return JSONResponse(health_data, status_code=status_code)

# ============ MCP 协议处理 ============

async def handle_mcp_request(request: Request) -> JSONResponse:
    """处理 MCP 请求"""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    app_state.request_count += 1
    
    try:
        body = await request.json()
    except json.JSONDecodeError:
        app_state.error_count += 1
        return JSONResponse(
            ResponseFormatter.error(
                ResponseCode.PARSE_ERROR,
                "无效的 JSON 请求体",
                "mcp",
                request_id=request_id
            ),
            status_code=400
        )
    
    method = body.get("method")
    params = body.get("params", {})
    
    logger.info(f"[{request_id}] MCP 请求: {method}")
    
    if method == "initialize":
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "searxng-mcp-server",
                    "version": app_state.version
                },
                "capabilities": {
                    "tools": {},
                    "logging": {}
                }
            }
        })
    
    elif method == "tools/list":
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "result": {"tools": MCP_TOOLS}
        })
    
    elif method == "tools/call":
        return await handle_tools_call(body, request_id, start_time)
    
    else:
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "error": {
                "code": -32601,
                "message": f"未知方法: {method}"
            }
        }, status_code=400)

async def handle_tools_call(body: Dict, request_id: str, start_time: float) -> JSONResponse:
    """处理工具调用"""
    params = body.get("params", {})
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    duration_ms = int((time.time() - start_time) * 1000)
    
    # 验证参数
    if tool_name == "search":
        valid, error, sanitized = validate_search_args(arguments)
        if not valid:
            return JSONResponse(
                ResponseFormatter.validation_error(
                    error, "search", request_id=request_id, duration_ms=duration_ms
                ),
                status_code=400
            )
        return await execute_search(sanitized, request_id, start_time)
    
    elif tool_name == "crawl":
        valid, error, sanitized = validate_crawl_args(arguments)
        if not valid:
            return JSONResponse(
                ResponseFormatter.validation_error(
                    error, "crawl", request_id=request_id, duration_ms=duration_ms
                ),
                status_code=400
            )
        return await execute_crawl(sanitized, request_id, start_time)
    
    elif tool_name == "health":
        valid, error, sanitized = validate_health_args(arguments)
        if not valid:
            return JSONResponse(
                ResponseFormatter.validation_error(
                    error, "health", request_id=request_id, duration_ms=duration_ms
                ),
                status_code=400
            )
        return await execute_health(request_id, start_time)
    
    else:
        duration_ms = int((time.time() - start_time) * 1000)
        app_state.error_count += 1
        return JSONResponse(
            ResponseFormatter.error(
                ResponseCode.NOT_FOUND,
                f"未知工具: {tool_name}",
                tool_name,
                request_id=request_id,
                duration_ms=duration_ms
            ),
            status_code=404
        )

async def execute_search(args: Dict, request_id: str, start_time: float) -> JSONResponse:
    """执行搜索"""
    try:
        result = await app_state.crawler.search_searxng(
            query=args['query'],
            engines=args.get('engines'),
            language=args.get('language', 'zh-CN'),
            num_results=args.get('num_results', 10),
            safe_search=args.get('safe_search', 1)
        )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return JSONResponse(
            ResponseFormatter.success(
                result, "search",
                request_id=request_id,
                duration_ms=duration_ms
            )
        )
        
    except SecurityError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        app_state.error_count += 1
        return JSONResponse(
            ResponseFormatter.security_error(
                str(e), "search",
                request_id=request_id,
                duration_ms=duration_ms
            ),
            status_code=403
        )
    except Exception as e:
        logger.error(f"[{request_id}] 搜索错误: {e}")
        duration_ms = int((time.time() - start_time) * 1000)
        app_state.error_count += 1
        return JSONResponse(
            ResponseFormatter.internal_error(
                f"搜索失败: {str(e)}", "search",
                request_id=request_id,
                duration_ms=duration_ms
            ),
            status_code=500
        )

async def execute_crawl(args: Dict, request_id: str, start_time: float) -> JSONResponse:
    """执行爬取"""
    try:
        result = await app_state.crawler.fetch_webpage(
            url=args['url'],
            max_length=args.get('max_length', 10000),
            extract_links=args.get('extract_links', False)
        )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return JSONResponse(
            ResponseFormatter.success(
                result, "crawl",
                request_id=request_id,
                duration_ms=duration_ms
            )
        )
        
    except SecurityError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        app_state.error_count += 1
        return JSONResponse(
            ResponseFormatter.security_error(
                str(e), "crawl",
                request_id=request_id,
                duration_ms=duration_ms
            ),
            status_code=403
        )
    except Exception as e:
        logger.error(f"[{request_id}] 爬取错误: {e}")
        duration_ms = int((time.time() - start_time) * 1000)
        app_state.error_count += 1
        return JSONResponse(
            ResponseFormatter.internal_error(
                f"爬取失败: {str(e)}", "crawl",
                request_id=request_id,
                duration_ms=duration_ms
            ),
            status_code=500
        )

async def execute_health(request_id: str, start_time: float) -> JSONResponse:
    """执行健康检查"""
    services = {
        "mcp_server": True,
        "crawler": app_state.crawler is not None,
    }
    
    searxng_healthy = False
    if app_state.crawler:
        try:
            import httpx
            response = await app_state.crawler.client.get(
                f"{SEARXNG_URL}/",
                timeout=5
            )
            searxng_healthy = response.status_code == 200
        except Exception:
            pass
    
    services["searxng"] = searxng_healthy
    
    healthy = all(services.values())
    
    duration_ms = int((time.time() - start_time) * 1000)
    
    result = {
        "status": "healthy" if healthy else "degraded",
        "version": app_state.version,
        "uptime_seconds": int(time.time() - app_state.started_at),
        "services": services
    }
    
    status_code = 200 if healthy else 503
    return JSONResponse(
        ResponseFormatter.success(
            result, "health",
            request_id=request_id,
            duration_ms=duration_ms
        ),
        status_code=status_code
    )

# ============ SSE 支持 ============

async def sse_endpoint(request: Request):
    """SSE 端点 - Server-Sent Events"""
    from starlette.responses import EventSourceResponse
    
    async def event_generator() -> AsyncGenerator[str, None]:
        request_id = str(uuid.uuid4())[:8]
        
        # 发送初始化事件
        yield json.dumps({
            "event": "connected",
            "data": {"request_id": request_id, "version": app_state.version}
        })
        
        # 保持连接活跃
        while True:
            await asyncio.sleep(30)
            yield json.dumps({"event": "ping", "data": {}})
    
    return EventSourceResponse(event_generator())

# ============ 创建应用 ============

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
]

routes = [
    Route("/health", health_check, methods=["GET"]),
    Route("/mcp", handle_mcp_request, methods=["POST"]),
    Route("/sse", sse_endpoint, methods=["GET"]),
]

app = Starlette(
    debug=os.getenv("DEBUG", "").lower() in ('true', '1', 'yes'),
    routes=routes,
    middleware=middleware,
    lifespan=lifespan
)

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "3001"))
    
    logger.info(f"启动服务器: {host}:{port}")
    uvicorn.run(app, host=host, port=port)