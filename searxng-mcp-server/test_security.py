"""
安全测试套件 - 验证 SSRF 防护和输入验证

测试内容：
- URL 验证（SSRF 防护）
- 输入净化
- 插件沙箱
- 错误处理
"""

import asyncio
import json
import sys
import unittest
from unittest.mock import Mock, patch, AsyncMock

# 确保能导入项目模块
sys.path.insert(0, '/tmp/searxng-mcp-server-fixed')

from utils.security import URLValidator, SecurityError, sanitize_input
from utils.validators import validate_search_args, validate_crawl_args, ValidationError
from utils.response import ResponseFormatter, ResponseCode, APIResponse
from enhanced_crawler import EnhancedWebCrawler
from plugin_manager import SecurePluginLoader, PluginSecurityError, PluginSecurityLevel


class TestURLValidator(unittest.TestCase):
    """测试 URL 验证器 - SSRF 防护"""
    
    def setUp(self):
        self.validator = URLValidator()
    
    # ========== SSRF 防护测试 ==========
    
    def test_block_private_ips(self):
        """测试阻止私有 IP"""
        private_ips = [
            'http://127.0.0.1/test',
            'http://192.168.1.1/test',
            'http://10.0.0.1/test',
            'http://172.16.0.1/test',
            'http://0.0.0.0/test',
            'http://localhost/test',
        ]
        
        for url in private_ips:
            is_valid, error = self.validator.validate(url)
            self.assertFalse(is_valid, f"应该阻止: {url}")
            self.assertIn('禁止', error)
    
    def test_block_metadata_endpoints(self):
        """测试阻止云元数据端点"""
        metadata_urls = [
            'http://169.254.169.254/latest/meta-data/',  # AWS
            'http://metadata.google.internal/',            # GCP
            'http://100.100.100.200/latest/meta-data/',   # 阿里云
        ]
        
        for url in metadata_urls:
            is_valid, error = self.validator.validate(url)
            self.assertFalse(is_valid, f"应该阻止: {url}")
    
    def test_block_dangerous_schemes(self):
        """测试阻止危险协议"""
        dangerous_urls = [
            'file:///etc/passwd',
            'ftp://attacker.com',
            'gopher://victim.com',
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
        ]
        
        for url in dangerous_urls:
            is_valid, error = self.validator.validate(url)
            self.assertFalse(is_valid, f"应该阻止: {url}")
    
    def test_allow_safe_urls(self):
        """测试允许安全 URL"""
        safe_urls = [
            'http://example.com',
            'https://www.google.com/search',
            'https://github.com/user/repo',
            'http://example.com:8080/path',
        ]
        
        for url in safe_urls:
            is_valid, error = self.validator.validate(url)
            self.assertTrue(is_valid, f"应该允许: {url} - {error}")
    
    def test_block_path_traversal(self):
        """测试阻止路径遍历"""
        urls = [
            'http://example.com/../../../etc/passwd',
            'http://example.com/..\\..\\windows\\system32',
        ]
        
        for url in urls:
            is_valid, error = self.validator.validate(url)
            self.assertFalse(is_valid, f"应该阻止路径遍历: {url}")
    
    def test_block_blocked_ports(self):
        """测试阻止特权端口"""
        for port in [22, 23, 25, 3306, 5432]:
            url = f'http://example.com:{port}/'
            is_valid, error = self.validator.validate(url)
            self.assertFalse(is_valid, f"应该阻止端口 {port}")


class TestInputValidation(unittest.TestCase):
    """测试输入验证"""
    
    # ========== 搜索参数验证 ==========
    
    def test_validate_search_query_required(self):
        """测试搜索查询必需"""
        valid, error, sanitized = validate_search_args({})
        self.assertFalse(valid)
        self.assertIn('query', error)
    
    def test_validate_search_query_length(self):
        """测试搜索查询长度限制"""
        # 太短
        valid, error, _ = validate_search_args({'query': ''})
        self.assertFalse(valid)
        
        # 太长
        valid, error, _ = validate_search_args({'query': 'x' * 1000})
        self.assertFalse(valid)
        
        # 正常
        valid, error, sanitized = validate_search_args({'query': 'test query'})
        self.assertTrue(valid)
        self.assertEqual(sanitized['query'], 'test query')
    
    def test_validate_search_num_results(self):
        """测试结果数量限制"""
        # 超出范围
        valid, error, _ = validate_search_args({
            'query': 'test',
            'num_results': 100
        })
        self.assertFalse(valid)
        
        # 正常
        valid, error, sanitized = validate_search_args({
            'query': 'test',
            'num_results': 10
        })
        self.assertTrue(valid)
        self.assertEqual(sanitized['num_results'], 10)
    
    def test_validate_search_language(self):
        """测试语言代码格式"""
        # 无效格式
        valid, error, _ = validate_search_args({
            'query': 'test',
            'language': 'invalid!!!'
        })
        self.assertFalse(valid)
        
        # 有效格式
        for lang in ['zh', 'en', 'zh-CN', 'en-US']:
            valid, error, sanitized = validate_search_args({
                'query': 'test',
                'language': lang
            })
            self.assertTrue(valid, f"应该接受: {lang}")
    
    # ========== 爬取参数验证 ==========
    
    def test_validate_crawl_url_required(self):
        """测试 URL 必需"""
        valid, error, _ = validate_crawl_args({})
        self.assertFalse(valid)
        self.assertIn('url', error)
    
    def test_validate_crawl_url_format(self):
        """测试 URL 格式"""
        # 无效格式
        valid, error, _ = validate_crawl_args({
            'url': 'not-a-url'
        })
        self.assertFalse(valid)
        
        # 有效格式
        valid, error, sanitized = validate_crawl_args({
            'url': 'https://example.com'
        })
        self.assertTrue(valid)
    
    def test_validate_crawl_max_length(self):
        """测试最大长度限制"""
        # 超出范围
        valid, error, _ = validate_crawl_args({
            'url': 'https://example.com',
            'max_length': 5
        })
        self.assertFalse(valid)
        
        # 正常
        valid, error, sanitized = validate_crawl_args({
            'url': 'https://example.com',
            'max_length': 1000
        })
        self.assertTrue(valid)
    
    def test_validate_crawl_boolean(self):
        """测试布尔值解析"""
        # 字符串形式的布尔值
        valid, error, sanitized = validate_crawl_args({
            'url': 'https://example.com',
            'extract_links': 'true'
        })
        self.assertTrue(valid)
        self.assertTrue(sanitized['extract_links'])
        
        # 整数形式的布尔值
        valid, error, sanitized = validate_crawl_args({
            'url': 'https://example.com',
            'extract_links': 1
        })
        self.assertTrue(valid)
        self.assertTrue(sanitized['extract_links'])


class TestResponseFormatter(unittest.TestCase):
    """测试响应格式化"""
    
    def test_success_response(self):
        """测试成功响应"""
        data = {'results': []}
        response = ResponseFormatter.success(data, 'search')
        
        self.assertTrue(response['success'])
        self.assertEqual(response['code'], 'SUCCESS')
        self.assertEqual(response['data'], data)
        self.assertIn('metadata', response)
        self.assertIn('timestamp', response['metadata'])
        self.assertIn('request_id', response['metadata'])
    
    def test_error_response(self):
        """测试错误响应"""
        response = ResponseFormatter.error(
            ResponseCode.SECURITY_ERROR,
            'SSRF detected',
            'crawl'
        )
        
        self.assertFalse(response['success'])
        self.assertEqual(response['code'], 'SECURITY_ERROR')
        self.assertEqual(response['message'], 'SSRF detected')
    
    def test_validation_error(self):
        """测试验证错误响应"""
        response = ResponseFormatter.validation_error(
            'Invalid query',
            'search',
            field='query'
        )
        
        self.assertFalse(response['success'])
        self.assertEqual(response['code'], 'VALIDATION_ERROR')
        self.assertEqual(response['details']['field'], 'query')


class TestSanitizeInput(unittest.TestCase):
    """测试输入净化"""
    
    def test_sanitize_control_chars(self):
        """测试移除控制字符"""
        result = sanitize_input('test\x00\x01\x02')
        self.assertEqual(result, 'test')
    
    def test_sanitize_length_limit(self):
        """测试长度限制"""
        result = sanitize_input('x' * 2000, max_length=100)
        self.assertEqual(len(result), 100)
    
    def test_sanitize_non_string(self):
        """测试非字符串输入"""
        result = sanitize_input(12345)
        self.assertEqual(result, '12345')


class TestPluginSecurity(unittest.TestCase):
    """测试插件安全"""
    
    def setUp(self):
        import tempfile
        import os
        self.temp_dir = tempfile.mkdtemp()
        self.os = os
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_ast_analysis_blocks_eval(self):
        """测试 AST 分析阻止 eval"""
        loader = SecurePluginLoader(plugins_dir=self.temp_dir)
        
        # 包含 eval 的代码应该被阻止
        code = '''
__plugin_name__ = 'test'
def execute(args):
    return eval(args['code'])
'''
        import tempfile
        import os
        
        plugin_file = os.path.join(self.temp_dir, 'test_eval.py')
        with open(plugin_file, 'w') as f:
            f.write(code)
        
        success, error = loader.load_plugin('test_eval.py')
        self.assertFalse(success)
        self.assertIn('安全分析失败', error)
    
    def test_ast_analysis_blocks_import_os(self):
        """测试 AST 分析阻止危险导入"""
        loader = SecurePluginLoader(plugins_dir=self.temp_dir)
        
        code = '''
__plugin_name__ = 'test'
import os
def execute(args):
    return os.system('ls')
'''
        plugin_file = self.os.path.join(self.temp_dir, 'test_os.py')
        with open(plugin_file, 'w') as f:
            f.write(code)
        
        success, error = loader.load_plugin('test_os.py')
        self.assertFalse(success)
        self.assertIn('禁止', error)
    
    def test_allowed_import(self):
        """测试允许的导入"""
        # 注意：SecurePluginLoader 会在沙箱中执行插件
        # 这里我们测试 AST 分析是否允许安全代码通过
        code = '''
__plugin_name__ = 'test_safe'
import json
import re

def execute(args):
    return {"safe": True}
'''
        # 直接测试 AST 分析
        loader = SecurePluginLoader(plugins_dir=self.temp_dir)
        is_safe, error = loader._analyze_ast(code, 'test.py')
        self.assertTrue(is_safe, f"AST 应该允许安全代码: {error}")


class TestCrawlerSecurity(unittest.TestCase):
    """测试爬虫安全"""
    
    @patch('enhanced_crawler.httpx.AsyncClient')
    async def test_crawler_blocks_private_ip(self, mock_client):
        """测试爬虫阻止私有 IP"""
        crawler = EnhancedWebCrawler(
            searxng_url='http://example.com',
            allow_private=False
        )
        
        with self.assertRaises(SecurityError):
            await crawler.fetch_webpage('http://127.0.0.1/admin')
        
        with self.assertRaises(SecurityError):
            await crawler.fetch_webpage('http://192.168.1.1/config')
        
        await crawler.close()


def run_async_test(coro):
    """运行异步测试"""
    return asyncio.get_event_loop().run_until_complete(coro)


def main():
    """运行所有测试"""
    print("=" * 60)
    print("SearXNG MCP Server 安全测试套件")
    print("=" * 60)
    
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加测试类
    suite.addTests(loader.loadTestsFromTestCase(TestURLValidator))
    suite.addTests(loader.loadTestsFromTestCase(TestInputValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestResponseFormatter))
    suite.addTests(loader.loadTestsFromTestCase(TestSanitizeInput))
    suite.addTests(loader.loadTestsFromTestCase(TestPluginSecurity))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # 统计结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    print(f"运行测试: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\n✅ 所有测试通过！")
        return 0
    else:
        print("\n❌ 存在失败的测试")
        return 1


if __name__ == '__main__':
    sys.exit(main())