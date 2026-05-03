"""
安全工具模块 - 提供 SSRF 防护、输入净化等安全功能
"""

import ipaddress
import re
from urllib.parse import urlparse
from typing import Tuple, Optional, Set
import logging

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """安全相关错误"""
    pass


class URLValidator:
    """
    URL 安全验证器 - 防止 SSRF 攻击
    
    功能：
    - 禁止访问私有 IP 地址
    - 禁止访问内网域名
    - 限制允许的协议和端口
    """
    
    # 禁止的 IP 网络（私有、保留、特殊用途）
    BLOCKED_IP_NETWORKS = [
        ipaddress.ip_network('0.0.0.0/8'),          # 当前网络
        ipaddress.ip_network('10.0.0.0/8'),         # 私有 A 类
        ipaddress.ip_network('100.64.0.0/10'),      # 运营商级 NAT
        ipaddress.ip_network('127.0.0.0/8'),        # 回环地址
        ipaddress.ip_network('169.254.0.0/16'),     # 链路本地
        ipaddress.ip_network('172.16.0.0/12'),      # 私有 B 类
        ipaddress.ip_network('192.0.0.0/24'),       # IETF 协议分配
        ipaddress.ip_network('192.0.2.0/24'),       # TEST-NET-1
        ipaddress.ip_network('192.88.99.0/24'),     # 6to4 中继
        ipaddress.ip_network('192.168.0.0/16'),     # 私有 C 类
        ipaddress.ip_network('198.18.0.0/15'),      # 基准测试
        ipaddress.ip_network('198.51.100.0/24'),    # TEST-NET-2
        ipaddress.ip_network('203.0.113.0/24'),     # TEST-NET-3
        ipaddress.ip_network('224.0.0.0/4'),        # 多播
        ipaddress.ip_network('240.0.0.0/4'),        # 保留
        ipaddress.ip_network('255.255.255.255/32'), # 广播
        # IPv6
        ipaddress.ip_network('::/128'),             # 未指定
        ipaddress.ip_network('::1/128'),            # 回环
        ipaddress.ip_network('fc00::/7'),           # 私有
        ipaddress.ip_network('fe80::/10'),          # 链路本地
        ipaddress.ip_network('ff00::/8'),           # 多播
    ]
    
    # 禁止的域名
    BLOCKED_HOSTNAMES = {
        'localhost', 'localhost.localdomain',
        '127.0.0.1', '::1',
        '0.0.0.0',
        'metadata.google.internal',  # GCP 元数据
        'metadata',                  # 通用元数据
        'instance-data',             # AWS EC2
    }
    
    # 允许的协议
    ALLOWED_SCHEMES = {'http', 'https'}
    
    # 禁止的端口（特权端口和常见内部服务）
    BLOCKED_PORTS = {22, 23, 25, 53, 110, 143, 3306, 5432, 6379, 27017}
    
    def __init__(self, allow_private: bool = False):
        """
        初始化验证器
        
        Args:
            allow_private: 是否允许访问私有 IP（仅用于测试）
        """
        self.allow_private = allow_private
    
    def validate(self, url: str, context: str = "") -> Tuple[bool, str]:
        """
        验证 URL 是否安全
        
        Args:
            url: 要验证的 URL
            context: 上下文信息（用于日志）
            
        Returns:
            (is_valid, error_message)
        """
        try:
            parsed = urlparse(url)
            
            # 1. 验证协议
            if parsed.scheme not in self.ALLOWED_SCHEMES:
                return False, f"不支持的协议: {parsed.scheme}"
            
            # 2. 验证有主机名
            hostname = parsed.hostname
            if not hostname:
                return False, "URL 缺少主机名"
            
            # 3. 检查主机名黑名单
            hostname_lower = hostname.lower()
            if hostname_lower in self.BLOCKED_HOSTNAMES:
                return False, f"禁止访问的主机名: {hostname}"
            
            # 4. 检查是否是 IP 地址
            try:
                ip = ipaddress.ip_address(hostname)
                if not self.allow_private:
                    if self._is_blocked_ip(ip):
                        return False, f"禁止访问的 IP 地址: {ip}"
            except ValueError:
                # 是域名，不是 IP
                pass
            
            # 5. 检查端口
            port = parsed.port
            if port and port in self.BLOCKED_PORTS:
                return False, f"禁止访问的端口: {port}"
            
            # 6. 检查 URL 路径中的危险字符
            if parsed.path and '..' in parsed.path:
                return False, "URL 路径包含危险字符"
            
            return True, "OK"
            
        except Exception as e:
            logger.error(f"URL 验证错误: {e}")
            return False, f"URL 验证失败: {str(e)}"
    
    def _is_blocked_ip(self, ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
        """检查 IP 是否在黑名单中"""
        for network in self.BLOCKED_IP_NETWORKS:
            if ip in network:
                return True
        return False
    
    def validate_searxng_url(self, url: str) -> str:
        """
        验证 SearXNG URL 并返回安全的 URL
        
        Raises:
            SecurityError: 如果 URL 不安全
        """
        is_valid, error = self.validate(url, context="SearXNG")
        if not is_valid:
            raise SecurityError(f"不安全的 SearXNG URL: {error}")
        return url


def sanitize_input(text: str, max_length: int = 1000, 
                   allowed_chars: Optional[str] = None) -> str:
    """
    净化用户输入
    
    Args:
        text: 输入文本
        max_length: 最大长度
        allowed_chars: 允许的字符集正则（默认允许大多数可见字符）
        
    Returns:
        净化后的文本
    """
    if not isinstance(text, str):
        text = str(text)
    
    # 截断长度
    if len(text) > max_length:
        text = text[:max_length]
    
    # 移除控制字符（保留换行和制表）
    text = ''.join(char for char in text if char >= ' ' or char in '\n\t\r')
    
    # 如果指定了允许的字符集，进行过滤
    if allowed_chars:
        text = ''.join(c for c in text if re.match(allowed_chars, c))
    
    return text.strip()


def sanitize_url(url: str) -> str:
    """
    净化 URL，移除可能的注入字符
    
    Args:
        url: 原始 URL
        
    Returns:
        净化后的 URL
    """
    if not url:
        return ""
    
    # 基本清理
    url = url.strip()
    
    # 移除 null 字节
    url = url.replace('\x00', '')
    
    # 限制长度
    if len(url) > 2000:
        url = url[:2000]
    
    return url


class SecureHTTPClient:
    """
    安全的 HTTP 客户端 - 内置 SSRF 防护
    """
    
    def __init__(self, url_validator: Optional[URLValidator] = None):
        self.url_validator = url_validator or URLValidator()
    
    async def get(self, url: str, **kwargs):
        """
        安全的 GET 请求
        
        Raises:
            SecurityError: 如果 URL 不安全
        """
        is_valid, error = self.url_validator.validate(url)
        if not is_valid:
            raise SecurityError(f"不安全的 URL: {error}")
        
        # 实际请求由调用方处理，这里只验证
        return True