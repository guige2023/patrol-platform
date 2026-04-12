"""
参数验证模块 - 验证 MCP 工具参数
"""

from typing import Dict, Any, Tuple, List, Optional
import re
import logging

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """验证错误"""
    pass


class ParamValidator:
    """参数验证器"""
    
    @staticmethod
    def validate_string(value: Any, name: str, 
                       min_len: int = 1, max_len: int = 1000,
                       pattern: Optional[str] = None) -> str:
        """验证字符串参数"""
        if not isinstance(value, str):
            raise ValidationError(f"{name} 必须是字符串，实际类型: {type(value).__name__}")
        
        if len(value) < min_len:
            raise ValidationError(f"{name} 长度至少 {min_len} 字符")
        
        if len(value) > max_len:
            raise ValidationError(f"{name} 长度不能超过 {max_len} 字符")
        
        if pattern and not re.match(pattern, value):
            raise ValidationError(f"{name} 格式无效")
        
        return value
    
    @staticmethod
    def validate_integer(value: Any, name: str,
                        min_val: Optional[int] = None,
                        max_val: Optional[int] = None) -> int:
        """验证整数参数"""
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise ValidationError(f"{name} 必须是整数")
        
        if min_val is not None and num < min_val:
            raise ValidationError(f"{name} 不能小于 {min_val}")
        
        if max_val is not None and num > max_val:
            raise ValidationError(f"{name} 不能大于 {max_val}")
        
        return num
    
    @staticmethod
    def validate_boolean(value: Any, name: str) -> bool:
        """验证布尔参数"""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        if isinstance(value, int):
            return bool(value)
        raise ValidationError(f"{name} 必须是布尔值")
    
    @staticmethod
    def validate_enum(value: Any, name: str, allowed: List[str]) -> str:
        """验证枚举值"""
        if value not in allowed:
            raise ValidationError(f"{name} 必须是 {allowed} 之一")
        return value


def validate_search_args(args: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    验证搜索工具参数
    
    Args:
        args: 原始参数
        
    Returns:
        (success, error_message, sanitized_args)
    """
    validator = ParamValidator()
    sanitized = {}
    
    try:
        # 必需参数
        if 'query' not in args or args['query'] is None:
            return False, "缺少必需的 'query' 参数", {}
        
        sanitized['query'] = validator.validate_string(
            args['query'], 'query', min_len=1, max_len=500
        )
        
        # 可选参数
        if 'engines' in args:
            engines = validator.validate_string(
                args['engines'], 'engines', max_len=200
            )
            sanitized['engines'] = engines
        
        if 'language' in args:
            lang = validator.validate_string(
                args['language'], 'language', max_len=10,
                pattern=r'^[a-z]{2}(-[A-Z]{2})?$'
            )
            sanitized['language'] = lang
        
        if 'num_results' in args:
            sanitized['num_results'] = validator.validate_integer(
                args['num_results'], 'num_results', min_val=1, max_val=50
            )
        
        if 'safe_search' in args:
            sanitized['safe_search'] = validator.validate_integer(
                args['safe_search'], 'safe_search', min_val=0, max_val=2
            )
        
        return True, "OK", sanitized
        
    except ValidationError as e:
        return False, str(e), {}


def validate_crawl_args(args: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    验证爬取工具参数
    
    Args:
        args: 原始参数
        
    Returns:
        (success, error_message, sanitized_args)
    """
    validator = ParamValidator()
    sanitized = {}
    
    try:
        # 必需参数
        if 'url' not in args or args['url'] is None:
            return False, "缺少必需的 'url' 参数", {}
        
        url = validator.validate_string(
            args['url'], 'url', min_len=5, max_len=2000
        )
        
        # 基础 URL 格式检查
        if not re.match(r'^https?://', url, re.IGNORECASE):
            return False, "URL 必须以 http:// 或 https:// 开头", {}
        
        sanitized['url'] = url
        
        # 可选参数
        if 'max_length' in args:
            sanitized['max_length'] = validator.validate_integer(
                args['max_length'], 'max_length', min_val=100, max_val=100000
            )
        else:
            sanitized['max_length'] = 10000
        
        if 'extract_links' in args:
            sanitized['extract_links'] = validator.validate_boolean(
                args['extract_links'], 'extract_links'
            )
        else:
            sanitized['extract_links'] = False
        
        if 'timeout' in args:
            sanitized['timeout'] = validator.validate_integer(
                args['timeout'], 'timeout', min_val=1, max_val=60
            )
        else:
            sanitized['timeout'] = 30
        
        return True, "OK", sanitized
        
    except ValidationError as e:
        return False, str(e), {}


def validate_health_args(args: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """验证健康检查参数"""
    # health 工具不需要参数
    return True, "OK", args or {}