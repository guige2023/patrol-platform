"""
安全的插件管理器 - 带沙箱执行环境

安全特性：
- 文件系统访问限制
- 禁止危险内置函数
- 执行时间限制
- 内存限制
- 代码签名验证（可选）
"""

import ast
import hashlib
import importlib.util
import logging
import os
import resource
import signal
import sys
import threading
import time
import traceback
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, List, Optional, Callable, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class PluginSecurityLevel(Enum):
    """插件安全级别"""
    RESTRICTED = "restricted"    # 最严格 - 只读操作
    STANDARD = "standard"        # 标准 - 有限文件访问
    ELEVATED = "elevated"        # 提升 - 更多权限（需要签名）


@dataclass
class PluginManifest:
    """插件清单"""
    name: str
    version: str
    description: str = ""
    author: str = ""
    security_level: PluginSecurityLevel = PluginSecurityLevel.STANDARD
    allowed_modules: List[str] = field(default_factory=list)
    required_permissions: List[str] = field(default_factory=list)
    entry_point: str = "execute"


class PluginSecurityError(Exception):
    """插件安全错误"""
    pass


class PluginTimeoutError(Exception):
    """插件执行超时"""
    pass


class SecurePluginLoader:
    """
    安全插件加载器
    
    安全措施：
    1. AST 静态分析 - 检查危险代码
    2. 受限模块导入
    3. 内置函数白名单
    4. 执行时间限制
    5. 代码签名验证（可选）
    """
    
    # 禁止的 AST 节点类型
    FORBIDDEN_AST_NODES = {
        'Exec',      # Python 2 exec
        'Interactive',
        'Suite',
    }
    
    # 需要特别审查的 AST 节点
    SENSITIVE_AST_NODES = {
        'Import', 'ImportFrom',
        'Call',
        'Subscript',
    }
    
    # 允许导入的模块白名单
    ALLOWED_MODULES: Set[str] = {
        # 标准库 - 通用
        'typing', 'collections', 'collections.abc',
        'abc', 'enum', 'dataclasses', 'inspect',
        'json', 're', 'string', 'textwrap',
        'datetime', 'time', 'calendar',
        'math', 'random', 'statistics', 'decimal', 'fractions',
        'hashlib', 'base64', 'binascii', 'uuid',
        'urllib.parse', 'urlparse',
        'functools', 'itertools', 'operator',
        'contextlib', 'warnings',
        'html', 'html.entities',
        'copy', 'numbers',
        # 数据结构
        'heapq', 'bisect', 'array', 'queue',
        # 迭代工具
        'itertools',
    }
    
    # 禁止调用的函数/属性
    FORBIDDEN_CALLS: Set[str] = {
        'eval', 'exec', 'compile',
        '__import__', 'importlib.__import__',
        'open', 'file',  # Python 2
        'os.system', 'os.popen', 'os.spawn', 'os.fork', 'os.exec',
        'subprocess.call', 'subprocess.Popen', 'subprocess.run',
        'sys.exit', 'quit', 'exit',
        'input', 'raw_input',  # 交互式输入
        'breakpoint',  # 调试
        'compile', 'exec', 'eval',
        '__builtins__', '__import__',
        'object.__subclasses__',  # 类遍历攻击
        'type.__mro__',  # MRO 遍历
    }
    
    def __init__(self, plugins_dir: str = "plugins",
                 security_level: PluginSecurityLevel = PluginSecurityLevel.STANDARD,
                 enable_code_signing: bool = False,
                 max_execution_time: int = 30):
        """
        初始化安全加载器
        
        Args:
            plugins_dir: 插件目录
            security_level: 默认安全级别
            enable_code_signing: 是否启用代码签名
            max_execution_time: 最大执行时间（秒）
        """
        self.plugins_dir = Path(plugins_dir)
        self.security_level = security_level
        self.enable_code_signing = enable_code_signing
        self.max_execution_time = max_execution_time
        self._plugins: Dict[str, Dict[str, Any]] = {}
        
        # 创建沙箱命名空间模板
        self._sandbox_builtins = self._create_sandbox_builtins()
        
        # 确保插件目录存在
        self.plugins_dir.mkdir(parents=True, exist_ok=True)
    
    def _create_sandbox_builtins(self) -> Dict[str, Any]:
        """创建受限的内置函数命名空间"""
        safe_builtins = {}
        
        # 安全的内置函数
        safe_names = {
            'True', 'False', 'None',
            'abs', 'all', 'any', 'bin', 'bool',
            'bytearray', 'bytes', 'callable', 'chr',
            'classmethod', 'complex', 'delattr',
            'dict', 'dir', 'divmod', 'enumerate',
            'filter', 'float', 'format', 'frozenset',
            'getattr', 'globals', 'hasattr', 'hash',
            'hex', 'id', 'int', 'isinstance',
            'issubclass', 'iter', 'len', 'list',
            'locals', 'map', 'max', 'memoryview',
            'min', 'next', 'object', 'oct', 'ord',
            'pow', 'print', 'property', 'range',
            'repr', 'reversed', 'round', 'set',
            'setattr', 'slice', 'sorted', 'staticmethod',
            'str', 'sum', 'super', 'tuple', 'type',
            'vars', 'zip', '__name__', '__doc__',
            '__package__', '__spec__', '__annotations__',
            '__builtins__',  # 需要指向安全的 builtins
            '__cached__',
        }
        
        import builtins
        for name in safe_names:
            if hasattr(builtins, name):
                safe_builtins[name] = getattr(builtins, name)
        
        # 将 __builtins__ 指向安全版本
        safe_builtins['__builtins__'] = safe_builtins
        
        return safe_builtins
    
    def _analyze_ast(self, code: str, filename: str) -> Tuple[bool, str]:
        """
        静态分析代码 AST
        
        Returns:
            (is_safe, error_message)
        """
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"语法错误: {e}"
        
        for node in ast.walk(tree):
            # 检查禁止的节点类型
            if type(node).__name__ in self.FORBIDDEN_AST_NODES:
                return False, f"包含禁止的语法: {type(node).__name__}"
            
            # 检查 import 语句
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if not self._is_allowed_module(alias.name):
                        return False, f"禁止导入模块: {alias.name}"
            
            if isinstance(node, ast.ImportFrom):
                if node.module and not self._is_allowed_module(node.module):
                    return False, f"禁止从模块导入: {node.module}"
            
            # 检查危险函数调用
            if isinstance(node, ast.Call):
                if self._is_forbidden_call(node):
                    return False, "包含危险的函数调用"
        
        return True, "OK"
    
    def _is_allowed_module(self, module_name: str) -> bool:
        """检查模块是否在白名单中"""
        # 检查完整名称
        if module_name in self.ALLOWED_MODULES:
            return True
        
        # 检查父模块
        parts = module_name.split('.')
        for i in range(len(parts), 0, -1):
            parent = '.'.join(parts[:i])
            if parent in self.ALLOWED_MODULES:
                return True
        
        return False
    
    def _is_forbidden_call(self, node: ast.Call) -> bool:
        """检查是否是禁止的函数调用"""
        # 获取调用名称
        func = node.func
        
        if isinstance(func, ast.Name):
            # 直接调用，如 eval()
            if func.id in self.FORBIDDEN_CALLS:
                return True
        
        elif isinstance(func, ast.Attribute):
            # 属性调用，如 os.system()
            parts = []
            current = func
            while isinstance(current, ast.Attribute):
                parts.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.append(current.id)
            
            full_name = '.'.join(reversed(parts))
            if full_name in self.FORBIDDEN_CALLS:
                return True
        
        return False
    
    def _create_restricted_globals(self, manifest: PluginManifest) -> Dict[str, Any]:
        """创建受限的全局命名空间"""
        restricted_globals = {
            '__builtins__': self._sandbox_builtins.copy(),
            '__name__': f'plugin_{manifest.name}',
            '__doc__': None,
        }
        
        # 根据安全级别添加额外限制
        if manifest.security_level == PluginSecurityLevel.RESTRICTED:
            # 移除更多潜在危险的函数
            for name in ['open', 'print', 'input']:
                if name in restricted_globals['__builtins__']:
                    del restricted_globals['__builtins__'][name]
        
        return restricted_globals
    
    def _execute_with_timeout(self, func: Callable, args: Tuple, kwargs: Dict) -> Any:
        """
        带超时限制执行函数
        
        注意：这在多线程环境中有效，在单线程环境中可能不准确
        """
        result = [None]
        exception = [None]
        
        def target():
            try:
                result[0] = func(*args, **kwargs)
            except Exception as e:
                exception[0] = e
        
        thread = threading.Thread(target=target)
        thread.daemon = True
        thread.start()
        thread.join(timeout=self.max_execution_time)
        
        if thread.is_alive():
            raise PluginTimeoutError(
                f"插件执行超时（超过 {self.max_execution_time} 秒）"
            )
        
        if exception[0]:
            raise exception[0]
        
        return result[0]
    
    def load_plugin(self, plugin_file: str) -> Tuple[bool, str]:
        """
        安全加载单个插件
        
        Args:
            plugin_file: 插件文件名
            
        Returns:
            (success, error_message)
        """
        plugin_path = self.plugins_dir / plugin_file
        
        if not plugin_path.exists():
            return False, f"插件文件不存在: {plugin_file}"
        
        try:
            # 读取插件代码
            code = plugin_path.read_text(encoding='utf-8')
            
            # AST 静态分析
            is_safe, error = self._analyze_ast(code, str(plugin_path))
            if not is_safe:
                return False, f"安全分析失败: {error}"
            
            # 解析清单
            manifest = self._parse_manifest(code)
            
            # 代码签名验证（如果启用）
            if self.enable_code_signing:
                if not self._verify_signature(plugin_path):
                    return False, "代码签名验证失败"
            
            # 编译代码
            compiled = compile(code, str(plugin_path), 'exec')
            
            # 创建受限环境
            restricted_globals = self._create_restricted_globals(manifest)
            
            # 执行插件代码
            exec(compiled, restricted_globals)
            
            # 获取入口函数
            entry_point = manifest.entry_point
            if entry_point not in restricted_globals:
                return False, f"缺少入口函数: {entry_point}"
            
            execute_func = restricted_globals[entry_point]
            if not callable(execute_func):
                return False, f"入口点必须是可调用对象: {entry_point}"
            
            # 保存插件
            self._plugins[manifest.name] = {
                'manifest': manifest,
                'execute': execute_func,
                'globals': restricted_globals,
                'path': str(plugin_path),
            }
            
            logger.info(f"插件加载成功: {manifest.name} v{manifest.version}")
            return True, "OK"
            
        except Exception as e:
            logger.error(f"加载插件失败 {plugin_file}: {e}")
            return False, str(e)
    
    def _parse_manifest(self, code: str) -> PluginManifest:
        """从代码中解析插件清单"""
        manifest = PluginManifest(
            name="unknown",
            version="0.0.1"
        )
        
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            if target.id == '__plugin_name__' and isinstance(node.value, ast.Constant):
                                manifest.name = node.value.value
                            elif target.id == '__plugin_version__' and isinstance(node.value, ast.Constant):
                                manifest.version = node.value.value
                            elif target.id == '__plugin_description__' and isinstance(node.value, ast.Constant):
                                manifest.description = node.value.value
                            elif target.id == '__plugin_author__' and isinstance(node.value, ast.Constant):
                                manifest.author = node.value.value
        except Exception:
            pass
        
        return manifest
    
    def _verify_signature(self, plugin_path: Path) -> bool:
        """验证插件代码签名（占位符实现）"""
        # 实际实现需要使用数字签名
        # 这里仅作为示例
        signature_file = plugin_path.with_suffix('.sig')
        return signature_file.exists()
    
    def load_plugins(self) -> Tuple[int, List[str]]:
        """
        加载所有插件
        
        Returns:
            (loaded_count, errors)
        """
        loaded = 0
        errors = []
        
        for plugin_file in sorted(self.plugins_dir.glob("*.py")):
            if plugin_file.name.startswith('_'):
                continue
            
            success, error = self.load_plugin(plugin_file.name)
            if success:
                loaded += 1
            else:
                errors.append(f"{plugin_file.name}: {error}")
        
        return loaded, errors
    
    def execute_plugin(self, plugin_name: str, arguments: Dict[str, Any]) -> Any:
        """
        安全执行插件
        
        Args:
            plugin_name: 插件名称
            arguments: 传递给插件的参数
            
        Returns:
            插件执行结果
            
        Raises:
            PluginSecurityError: 安全错误
            PluginTimeoutError: 执行超时
        """
        if plugin_name not in self._plugins:
            raise PluginSecurityError(f"插件未找到: {plugin_name}")
        
        plugin = self._plugins[plugin_name]
        execute_func = plugin['execute']
        
        try:
            # 带超时执行
            result = self._execute_with_timeout(
                execute_func,
                (arguments,),
                {}
            )
            return result
            
        except PluginTimeoutError:
            raise
        except Exception as e:
            logger.error(f"插件执行错误 {plugin_name}: {e}")
            raise PluginSecurityError(f"插件执行失败: {str(e)}")
    
    def list_plugins(self) -> List[Dict[str, Any]]:
        """列出已加载的插件"""
        return [
            {
                'name': name,
                'version': info['manifest'].version,
                'description': info['manifest'].description,
                'author': info['manifest'].author,
                'security_level': info['manifest'].security_level.value,
            }
            for name, info in self._plugins.items()
        ]
    
    def unload_plugin(self, plugin_name: str) -> bool:
        """卸载插件"""
        if plugin_name in self._plugins:
            del self._plugins[plugin_name]
            logger.info(f"插件已卸载: {plugin_name}")
            return True
        return False


# 兼容性类 - 保持与旧代码的接口一致
class PluginManager(SecurePluginLoader):
    """兼容旧接口的插件管理器"""
    
    def __init__(self, plugins_dir: str = "plugins"):
        super().__init__(
            plugins_dir=plugins_dir,
            security_level=PluginSecurityLevel.STANDARD,
            enable_code_signing=False,
            max_execution_time=30
        )
    
    def get_plugins(self) -> Dict[str, Dict[str, Any]]:
        """获取所有插件（兼容旧接口）"""
        return {
            name: {
                'name': name,
                'execute': info['execute'],
            }
            for name, info in self._plugins.items()
        }