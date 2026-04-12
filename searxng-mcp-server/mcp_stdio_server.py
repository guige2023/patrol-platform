"""
MCP Stdio 服务器 - 通过标准输入/输出与 MCP 客户端通信

安全特性：
- 输入验证和长度限制
- JSON 解析错误处理
- 超时保护
- 安全的错误信息

AI 友好特性：
- 结构化 JSON 响应
- 统一的错误码
- 请求追踪
"""

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

# 配置日志到 stderr（避免干扰 stdout 通信）
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 导入安全模块
from utils.security import SecurityError
from utils.validators import validate_search_args, validate_crawl_args, ValidationError
from utils.response import APIResponse, ResponseCode, ResponseFormatter
from enhanced_crawler import EnhancedWebCrawler
from plugin_manager import PluginManager, PluginSecurityError

# 配置
SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")
PLUGINS_DIR = os.getenv("PLUGINS_DIR", "plugins")
ALLOW_PRIVATE_IPS = os.getenv("ALLOW_PRIVATE_IPS", "").lower() in ('true', '1', 'yes')
MAX_MESSAGE_SIZE = int(os.getenv("MAX_MESSAGE_SIZE", "1048576"))  # 1MB
READ_TIMEOUT = int(os.getenv("READ_TIMEOUT", "300"))  # 5分钟

# 工具定义
SEARCH_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "搜索查询词",
            "minLength": 1,
            "maxLength": 500
        },
        "engines": {
            "type": "string",
            "description": "搜索引擎列表",
            "default": ""
        },
        "language": {
            "type": "string",
            "description": "语言代码",
            "default": "zh-CN"
        },
        "num_results": {
            "type": "integer",
            "description": "结果数量",
            "minimum": 1,
            "maximum": 50,
            "default": 10
        },
        "safe_search": {
            "type": "integer",
            "description": "安全搜索级别",
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
            "description": "要爬取的 URL",
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
            "description": "是否提取链接",
            "default": False
        },
        "timeout": {
            "type": "integer",
            "description": "超时时间（秒）",
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
    "description": "健康检查"
}

MCP_TOOLS = [
    {
        "name": "search",
        "description": "使用 SearXNG 搜索网络",
        "inputSchema": SEARCH_TOOL_SCHEMA
    },
    {
        "name": "crawl",
        "description": "爬取指定 URL 的网页内容",
        "inputSchema": CRAWL_TOOL_SCHEMA
    },
    {
        "name": "health",
        "description": "检查服务健康状态",
        "inputSchema": HEALTH_TOOL_SCHEMA
    }
]


class MCPStdioServer:
    """MCP Stdio 服务器"""
    
    VERSION = "2.0.0"
    PROTOCOL_VERSION = "2024-11-05"
    
    def __init__(self):
        self.crawler: Optional[EnhancedWebCrawler] = None
        self.plugin_manager: Optional[PluginManager] = None
        self.api_response = APIResponse()
        self.running = False
    
    async def initialize(self):
        """初始化服务"""
        logger.info(f"初始化 MCP Stdio Server v{self.VERSION}")
        
        # 初始化爬虫
        self.crawler = EnhancedWebCrawler(
            searxng_url=SEARXNG_URL,
            allow_private=ALLOW_PRIVATE_IPS
        )
        
        # 初始化插件管理器
        self.plugin_manager = PluginManager(plugins_dir=PLUGINS_DIR)
        loaded, errors = self.plugin_manager.load_plugins()
        logger.info(f"插件加载: {loaded} 成功, {len(errors)} 失败")
        
        self.running = True
    
    async def run(self):
        """运行服务器主循环"""
        await self.initialize()
        
        logger.info("服务器已启动，等待请求...")
        
        while self.running:
            try:
                # 读取一行输入（带超时）
                line = await asyncio.wait_for(
                    self._read_line(),
                    timeout=READ_TIMEOUT
                )
                
                if not line:
                    continue
                
                # 处理请求
                response = await self._handle_message(line)
                
                # 发送响应
                if response:
                    self._send_response(response)
                    
            except asyncio.TimeoutError:
                logger.warning("读取超时，发送心跳")
                continue
            except EOFError:
                logger.info("输入结束，关闭服务器")
                break
            except Exception as e:
                logger.error(f"处理错误: {e}")
                error_response = self._create_error_response(
                    -32603, f"内部错误: {str(e)}"
                )
                self._send_response(error_response)
        
        await self.shutdown()
    
    async def _read_line(self) -> Optional[str]:
        """异步读取一行输入"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sys.stdin.readline)
    
    def _send_response(self, response: Dict):
        """发送 JSON-RPC 响应"""
        try:
            json_str = json.dumps(response, ensure_ascii=False)
            sys.stdout.write(json_str + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"发送响应失败: {e}")
    
    def _create_success_response(self, id: Any, result: Any) -> Dict:
        """创建成功响应"""
        return {
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        }
    
    def _create_error_response(self, code: int, message: str, 
                               id: Any = None, data: Any = None) -> Dict:
        """创建错误响应"""
        error = {
            "code": code,
            "message": message
        }
        if data is not None:
            error["data"] = data
        
        return {
            "jsonrpc": "2.0",
            "id": id,
            "error": error
        }
    
    async def _handle_message(self, line: str) -> Optional[Dict]:
        """处理单条消息"""
        # 检查消息大小
        if len(line) > MAX_MESSAGE_SIZE:
            return self._create_error_response(
                -32700, f"消息过大（最大 {MAX_MESSAGE_SIZE} 字节）"
            )
        
        line = line.strip()
        if not line:
            return None
        
        # 解析 JSON
        try:
            message = json.loads(line)
        except json.JSONDecodeError as e:
            return self._create_error_response(
                -32700, f"JSON 解析错误: {str(e)}"
            )
        
        # 验证 JSON-RPC 格式
        if not isinstance(message, dict):
            return self._create_error_response(
                -32600, "请求必须是 JSON 对象"
            )
        
        jsonrpc = message.get("jsonrpc")
        if jsonrpc != "2.0":
            return self._create_error_response(
                -32600, "不支持的 JSON-RPC 版本"
            )
        
        method = message.get("method")
        msg_id = message.get("id")
        params = message.get("params", {})
        
        # 处理请求
        if method == "initialize":
            return self._handle_initialize(msg_id, params)
        
        elif method == "tools/list":
            return self._handle_tools_list(msg_id)
        
        elif method == "tools/call":
            return await self._handle_tools_call(msg_id, params)
        
        elif method == "notifications/initialized":
            # 通知，不需要响应
            return None
        
        else:
            return self._create_error_response(
                -32601, f"未知方法: {method}", msg_id
            )
    
    def _handle_initialize(self, id: Any, params: Dict) -> Dict:
        """处理初始化请求"""
        client_info = params.get("clientInfo", {})
        logger.info(f"客户端初始化: {client_info.get('name', 'unknown')} "
                   f"v{client_info.get('version', 'unknown')}")
        
        return self._create_success_response(id, {
            "protocolVersion": self.PROTOCOL_VERSION,
            "serverInfo": {
                "name": "searxng-mcp-server",
                "version": self.VERSION
            },
            "capabilities": {
                "tools": {},
                "logging": {}
            }
        })
    
    def _handle_tools_list(self, id: Any) -> Dict:
        """处理工具列表请求"""
        return self._create_success_response(id, {"tools": MCP_TOOLS})
    
    async def _handle_tools_call(self, id: Any, params: Dict) -> Dict:
        """处理工具调用请求"""
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        logger.info(f"调用工具: {tool_name}")
        
        if tool_name == "search":
            return await self._execute_search(id, arguments)
        
        elif tool_name == "crawl":
            return await self._execute_crawl(id, arguments)
        
        elif tool_name == "health":
            return await self._execute_health(id)
        
        else:
            return self._create_error_response(
                -32601, f"未知工具: {tool_name}", id
            )
    
    async def _execute_search(self, id: Any, args: Dict) -> Dict:
        """执行搜索"""
        # 验证参数
        valid, error, sanitized = validate_search_args(args)
        if not valid:
            return self._create_error_response(
                -32602, f"参数验证失败: {error}", id
            )
        
        try:
            result = await self.crawler.search_searxng(
                query=sanitized['query'],
                engines=sanitized.get('engines'),
                language=sanitized.get('language', 'zh-CN'),
                num_results=sanitized.get('num_results', 10),
                safe_search=sanitized.get('safe_search', 1)
            )
            
            return self._create_success_response(id, {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, ensure_ascii=False, indent=2)
                    }
                ],
                "isError": False
            })
            
        except SecurityError as e:
            return self._create_error_response(
                -32001, f"安全错误: {str(e)}", id
            )
        except Exception as e:
            logger.error(f"搜索错误: {e}")
            return self._create_error_response(
                -32603, f"搜索失败: {str(e)}", id
            )
    
    async def _execute_crawl(self, id: Any, args: Dict) -> Dict:
        """执行爬取"""
        # 验证参数
        valid, error, sanitized = validate_crawl_args(args)
        if not valid:
            return self._create_error_response(
                -32602, f"参数验证失败: {error}", id
            )
        
        try:
            result = await self.crawler.fetch_webpage(
                url=sanitized['url'],
                max_length=sanitized.get('max_length', 10000),
                extract_links=sanitized.get('extract_links', False)
            )
            
            return self._create_success_response(id, {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, ensure_ascii=False, indent=2)
                    }
                ],
                "isError": False
            })
            
        except SecurityError as e:
            return self._create_error_response(
                -32001, f"安全错误: {str(e)}", id
            )
        except Exception as e:
            logger.error(f"爬取错误: {e}")
            return self._create_error_response(
                -32603, f"爬取失败: {str(e)}", id
            )
    
    async def _execute_health(self, id: Any) -> Dict:
        """执行健康检查"""
        services = {
            "crawler": self.crawler is not None,
            "searxng": False
        }
        
        # 检查 SearXNG
        if self.crawler:
            try:
                import httpx
                response = await self.crawler.client.get(
                    f"{SEARXNG_URL}/",
                    timeout=5
                )
                services["searxng"] = response.status_code == 200
            except Exception:
                pass
        
        healthy = all(services.values())
        
        result = {
            "status": "healthy" if healthy else "degraded",
            "version": self.VERSION,
            "services": services
        }
        
        return self._create_success_response(id, {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(result, ensure_ascii=False, indent=2)
                }
            ],
            "isError": False
        })
    
    async def shutdown(self):
        """关闭服务器"""
        logger.info("正在关闭服务器...")
        self.running = False
        
        if self.crawler:
            await self.crawler.close()
        
        logger.info("服务器已关闭")


async def main():
    """主入口"""
    server = MCPStdioServer()
    
    try:
        await server.run()
    except KeyboardInterrupt:
        logger.info("收到中断信号")
        await server.shutdown()
    except Exception as e:
        logger.error(f"服务器错误: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())