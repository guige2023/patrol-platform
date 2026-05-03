"""
响应格式化模块 - 标准化 API 响应格式
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum
import uuid
import logging

logger = logging.getLogger(__name__)


class ResponseCode(Enum):
    """响应状态码"""
    SUCCESS = "SUCCESS"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SECURITY_ERROR = "SECURITY_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"
    PARSE_ERROR = "PARSE_ERROR"
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"


class ResponseFormatter:
    """
    响应格式化器 - 统一 MCP 响应格式
    
    标准化的响应结构:
    {
        "success": bool,
        "code": str,           # 机器可读的错误码
        "message": str,        # 人类可读的消息
        "data": {...},         # 业务数据
        "metadata": {          # 元数据
            "timestamp": str,
            "request_id": str,
            "tool": str,
            "duration_ms": int
        }
    }
    """
    
    @staticmethod
    def success(data: Any, tool: str, 
                message: str = "操作成功",
                request_id: Optional[str] = None,
                duration_ms: Optional[int] = None) -> Dict[str, Any]:
        """
        创建成功响应
        
        Args:
            data: 响应数据
            tool: 工具名称
            message: 成功消息
            request_id: 请求 ID
            duration_ms: 处理耗时（毫秒）
        """
        return {
            "success": True,
            "code": ResponseCode.SUCCESS.value,
            "message": message,
            "data": data,
            "metadata": {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "request_id": request_id or str(uuid.uuid4())[:8],
                "tool": tool,
                "duration_ms": duration_ms or 0
            }
        }
    
    @staticmethod
    def error(code: ResponseCode, message: str, tool: str,
              details: Optional[Dict] = None,
              request_id: Optional[str] = None,
              duration_ms: Optional[int] = None) -> Dict[str, Any]:
        """
        创建错误响应
        
        Args:
            code: 错误码
            message: 错误消息
            tool: 工具名称
            details: 详细错误信息
            request_id: 请求 ID
            duration_ms: 处理耗时（毫秒）
        """
        response = {
            "success": False,
            "code": code.value,
            "message": message,
            "data": None,
            "metadata": {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "request_id": request_id or str(uuid.uuid4())[:8],
                "tool": tool,
                "duration_ms": duration_ms or 0
            }
        }
        if details:
            response["details"] = details
        return response
    
    @classmethod
    def validation_error(cls, message: str, tool: str, 
                         field: Optional[str] = None) -> Dict[str, Any]:
        """创建验证错误响应"""
        details = {"field": field} if field else None
        return cls.error(ResponseCode.VALIDATION_ERROR, message, tool, details)
    
    @classmethod
    def security_error(cls, message: str, tool: str) -> Dict[str, Any]:
        """创建安全错误响应"""
        return cls.error(ResponseCode.SECURITY_ERROR, message, tool)
    
    @classmethod
    def network_error(cls, message: str, tool: str) -> Dict[str, Any]:
        """创建网络错误响应"""
        return cls.error(ResponseCode.NETWORK_ERROR, message, tool)
    
    @classmethod
    def internal_error(cls, message: str, tool: str) -> Dict[str, Any]:
        """创建内部错误响应"""
        return cls.error(ResponseCode.INTERNAL_ERROR, message, tool)


class SearchResponseFormatter:
    """搜索结果响应格式化器"""
    
    @staticmethod
    def format_search_results(results: List[Dict[str, str]], 
                              query: str,
                              engine: str = "searxng") -> Dict[str, Any]:
        """
        格式化搜索结果
        
        Args:
            results: 原始搜索结果列表
            query: 搜索查询
            engine: 搜索引擎名称
            
        Returns:
            标准化的搜索结果
        """
        formatted = []
        for i, result in enumerate(results):
            formatted.append({
                "rank": i + 1,
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "snippet": result.get("content", ""),
                "engine": result.get("engine", engine)
            })
        
        return {
            "query": query,
            "total_results": len(formatted),
            "results": formatted
        }
    
    @staticmethod
    def format_crawl_result(url: str, title: str, content: str,
                           links: Optional[List[str]] = None,
                           metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        格式化爬取结果
        
        Args:
            url: 目标 URL
            title: 页面标题
            content: 页面内容
            links: 提取的链接
            metadata: 额外元数据
            
        Returns:
            标准化的爬取结果
        """
        result = {
            "url": url,
            "title": title,
            "content": content,
            "content_length": len(content),
            "links_extracted": len(links) if links else 0
        }
        
        if links:
            result["links"] = links[:100]  # 限制链接数量
        
        if metadata:
            result["metadata"] = metadata
        
        return result


class APIResponse:
    """
    API 响应构建器 - 兼容 MCP 协议
    """
    
    def __init__(self):
        self.formatter = ResponseFormatter()
        self.search_formatter = SearchResponseFormatter()
    
    def mcp_response(self, content: Any, is_error: bool = False) -> List[Dict[str, Any]]:
        """
        创建 MCP 格式的响应
        
        MCP 响应格式:
        {
            "content": [
                {"type": "text", "text": "..."}
            ],
            "isError": false
        }
        """
        import json
        
        if isinstance(content, dict):
            text = json.dumps(content, ensure_ascii=False, indent=2)
        elif isinstance(content, list):
            text = json.dumps(content, ensure_ascii=False, indent=2)
        else:
            text = str(content)
        
        return [
            {
                "type": "text",
                "text": text
            }
        ]
    
    def mcp_error(self, message: str) -> List[Dict[str, Any]]:
        """创建 MCP 错误响应"""
        return self.mcp_response(
            {"error": message, "success": False},
            is_error=True
        )
    
    def mcp_success(self, data: Any) -> List[Dict[str, Any]]:
        """创建 MCP 成功响应"""
        return self.mcp_response(
            {"success": True, "data": data},
            is_error=False
        )
    
    @staticmethod
    def tool_definition(name: str, description: str,
                       input_schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建工具定义
        
        Args:
            name: 工具名称
            description: 工具描述
            input_schema: 输入参数 JSON Schema
            
        Returns:
            MCP 工具定义
        """
        return {
            "name": name,
            "description": description,
            "inputSchema": input_schema
        }
    
    @staticmethod
    def health_status(healthy: bool, version: str = "2.0.0",
                     services: Optional[Dict[str, bool]] = None) -> Dict[str, Any]:
        """
        创建健康检查状态
        
        Args:
            healthy: 整体健康状态
            version: 服务版本
            services: 各服务健康状态
            
        Returns:
            健康状态对象
        """
        return {
            "status": "healthy" if healthy else "unhealthy",
            "version": version,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "services": services or {}
        }