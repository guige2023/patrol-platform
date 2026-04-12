"""
增强版 Web 爬虫 - 带 SSRF 防护和 AI 友好输出
"""

import asyncio
import hashlib
import html
import json
import logging
import random
import time
from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urljoin, urlparse, parse_qs
from datetime import datetime, timedelta
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup

from utils.security import URLValidator, SecurityError, sanitize_input
from utils.response import SearchResponseFormatter

logger = logging.getLogger(__name__)

# 用户代理列表
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
]


@dataclass
class RateLimitConfig:
    """速率限制配置"""
    requests_per_minute: int = 30
    requests_per_hour: int = 500
    burst_size: int = 5


@dataclass
class CacheEntry:
    """缓存条目"""
    data: Dict[str, Any]
    timestamp: datetime
    expires_at: datetime


class RateLimiter:
    """速率限制器 - 按域名限制请求频率"""
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._requests: Dict[str, List[datetime]] = {}
        self._lock = asyncio.Lock()
    
    async def acquire(self, domain: str) -> Tuple[bool, Optional[float]]:
        """
        获取请求许可
        
        Returns:
            (allowed, wait_seconds)
        """
        async with self._lock:
            now = datetime.utcnow()
            
            # 清理过期记录
            cutoff = now - timedelta(hours=1)
            self._requests[domain] = [
                t for t in self._requests.get(domain, [])
                if t > cutoff
            ]
            
            requests = self._requests.get(domain, [])
            
            # 检查每分钟限制
            minute_cutoff = now - timedelta(minutes=1)
            minute_count = sum(1 for t in requests if t > minute_cutoff)
            
            if minute_count >= self.config.requests_per_minute:
                oldest = min(t for t in requests if t > minute_cutoff)
                wait = (oldest + timedelta(minutes=1) - now).total_seconds()
                return False, max(wait, 1.0)
            
            # 检查每小时限制
            if len(requests) >= self.config.requests_per_hour:
                oldest = min(requests)
                wait = (oldest + timedelta(hours=1) - now).total_seconds()
                return False, max(wait, 1.0)
            
            # 允许请求
            requests.append(now)
            self._requests[domain] = requests
            return True, None
    
    async def wait_if_needed(self, domain: str):
        """如果需要则等待"""
        allowed, wait = await self.acquire(domain)
        while not allowed:
            logger.warning(f"速率限制: 等待 {wait:.1f} 秒后重试 {domain}")
            await asyncio.sleep(wait)
            allowed, wait = await self.acquire(domain)


class SimpleCache:
    """简单的内存缓存"""
    
    def __init__(self, default_ttl: int = 300):
        self._cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        self._lock = asyncio.Lock()
    
    def _make_key(self, *args) -> str:
        """生成缓存键"""
        key_str = json.dumps(args, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    async def get(self, *args) -> Optional[Dict[str, Any]]:
        """获取缓存值"""
        key = self._make_key(*args)
        async with self._lock:
            entry = self._cache.get(key)
            if entry and datetime.utcnow() < entry.expires_at:
                return entry.data
            if entry:
                del self._cache[key]
            return None
    
    async def set(self, data: Dict[str, Any], *args, ttl: Optional[int] = None):
        """设置缓存值"""
        key = self._make_key(*args)
        async with self._lock:
            self._cache[key] = CacheEntry(
                data=data,
                timestamp=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(seconds=ttl or self.default_ttl)
            )
    
    async def clear(self):
        """清空缓存"""
        async with self._lock:
            self._cache.clear()


class EnhancedWebCrawler:
    """
    增强版 Web 爬虫 - 带 SSRF 防护
    
    安全特性：
    - URL 安全验证（防止 SSRF）
    - 请求速率限制
    - 响应缓存
    - 用户代理轮换
    """
    
    def __init__(self, 
                 searxng_url: str = "http://localhost:8080",
                 timeout: int = 30,
                 cache_ttl: int = 300,
                 allow_private: bool = False):
        """
        初始化爬虫
        
        Args:
            searxng_url: SearXNG 实例 URL
            timeout: 请求超时时间（秒）
            cache_ttl: 缓存 TTL（秒）
            allow_private: 是否允许访问私有 IP（仅用于测试）
        """
        # URL 验证
        self.url_validator = URLValidator(allow_private=allow_private)
        
        try:
            self.searxng_url = self.url_validator.validate_searxng_url(searxng_url)
        except SecurityError as e:
            logger.error(f"不安全的 SearXNG URL: {e}")
            raise
        
        self.timeout = timeout
        self.cache = SimpleCache(cache_ttl)
        self.rate_limiter = RateLimiter()
        
        # 创建安全的 HTTP 客户端
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10),
            headers={"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"},
            follow_redirects=True,
            max_redirects=5,
            # 禁用 HTTP/2 避免某些问题
            http2=False,
        )
    
    def _get_random_user_agent(self) -> str:
        """获取随机用户代理"""
        return random.choice(USER_AGENTS)
    
    async def fetch_webpage(self, url: str, max_length: int = 10000,
                           extract_links: bool = False) -> Dict[str, Any]:
        """
        获取网页内容 - 带 SSRF 防护
        
        Args:
            url: 目标 URL
            max_length: 最大内容长度
            extract_links: 是否提取链接
            
        Returns:
            标准化的爬取结果
            
        Raises:
            SecurityError: 如果 URL 不安全
        """
        # 1. 验证 URL 安全
        is_valid, error = self.url_validator.validate(url, context="fetch")
        if not is_valid:
            raise SecurityError(f"不安全的 URL: {error}")
        
        # 2. 检查缓存
        cache_key = ("fetch", url, max_length)
        cached = await self.cache.get(*cache_key)
        if cached:
            logger.debug(f"缓存命中: {url}")
            return cached
        
        # 3. 速率限制
        domain = urlparse(url).netloc
        await self.rate_limiter.wait_if_needed(domain)
        
        # 4. 发起请求
        start_time = time.time()
        try:
            headers = {"User-Agent": self._get_random_user_agent()}
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()
            
            # 5. 检查内容类型（只允许 HTML）
            content_type = response.headers.get('content-type', '').lower()
            if not any(ct in content_type for ct in ['text/html', 'application/xhtml', 'application/xml']):
                raise SecurityError(f"不支持的内容类型: {content_type}")
            
            # 6. 解析内容
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 提取标题
            title = ""
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text(strip=True)
            
            # 提取正文
            content = self._extract_content(soup)
            if len(content) > max_length:
                content = content[:max_length] + "..."
            
            # 提取链接
            links = []
            if extract_links:
                links = self._extract_links(soup, url)
            
            # 7. 构建结果
            result = SearchResponseFormatter.format_crawl_result(
                url=url,
                title=title,
                content=content,
                links=links,
                metadata={
                    "status_code": response.status_code,
                    "content_type": content_type,
                    "fetch_time_ms": int((time.time() - start_time) * 1000)
                }
            )
            
            # 8. 缓存结果
            await self.cache.set(result, *cache_key)
            
            return result
            
        except httpx.TimeoutException:
            raise SecurityError(f"请求超时: {url}")
        except httpx.HTTPStatusError as e:
            raise SecurityError(f"HTTP 错误 {e.response.status_code}: {url}")
        except Exception as e:
            logger.error(f"获取页面失败 {url}: {e}")
            raise SecurityError(f"获取页面失败: {str(e)}")
    
    def _extract_content(self, soup: BeautifulSoup) -> str:
        """从 BeautifulSoup 提取正文内容"""
        # 移除脚本和样式
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
            tag.decompose()
        
        # 尝试找到主要内容区域
        main_content = None
        for selector in ['main', 'article', '[role="main"]', '#content', '.content']:
            main_content = soup.select_one(selector)
            if main_content:
                break
        
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
        
        # 清理文本
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)
    
    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """提取页面链接"""
        links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            full_url = urljoin(base_url, href)
            # 只保留 HTTP/HTTPS 链接
            if full_url.startswith(('http://', 'https://')):
                links.append(full_url)
        return list(set(links))[:100]  # 去重并限制数量
    
    async def search_searxng(self, query: str, 
                            engines: Optional[str] = None,
                            language: str = "zh-CN",
                            num_results: int = 10,
                            safe_search: int = 1) -> Dict[str, Any]:
        """
        使用 SearXNG 进行搜索
        
        Args:
            query: 搜索查询
            engines: 搜索引擎列表（逗号分隔）
            language: 语言代码
            num_results: 结果数量
            safe_search: 安全搜索级别 (0-2)
            
        Returns:
            标准化的搜索结果
        """
        # 检查缓存
        cache_key = ("search", query, engines, language, num_results)
        cached = await self.cache.get(*cache_key)
        if cached:
            return cached
        
        # 速率限制
        domain = urlparse(self.searxng_url).netloc
        await self.rate_limiter.wait_if_needed(domain)
        
        try:
            params = {
                'q': query,
                'format': 'json',
                'language': language,
                'safesearch': safe_search,
                'pageno': 1
            }
            
            if engines:
                params['engines'] = engines
            
            headers = {"User-Agent": self._get_random_user_agent()}
            
            response = await self.client.get(
                f"{self.searxng_url}/search",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            results = data.get('results', [])
            
            # 格式化结果
            formatted = SearchResponseFormatter.format_search_results(
                results[:num_results],
                query=query
            )
            
            # 缓存
            await self.cache.set(formatted, *cache_key)
            
            return formatted
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            raise SecurityError(f"搜索失败: {str(e)}")
    
    async def close(self):
        """关闭 HTTP 客户端"""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, *args):
        await self.close()
        return False