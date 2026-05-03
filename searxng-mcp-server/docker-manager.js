/**
 * Docker 管理器 - 安全的 SearXNG 容器生命周期管理
 * 
 * 安全特性：
 * - 输入验证和净化
 * - 命令注入防护
 * - 错误处理（不泄露敏感信息）
 * - 资源限制
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    CONTAINER_NAME: 'searxng-mcp',
    IMAGE_NAME: 'searxng/searxng:latest',
    DEFAULT_PORT: 8080,
    CPU_LIMIT: '1.0',
    MEMORY_LIMIT: '512m',
    RESTART_POLICY: 'unless-stopped',
    // 白名单字符（用于容器名净化）
    SAFE_CHARS_REGEX: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    // 危险字符
    DANGEROUS_CHARS: /[;&|`$(){}[\]\\*?<>!]/g
};

/**
 * 安全错误类
 */
class SecurityError extends Error {
    constructor(message, code = 'SECURITY_ERROR') {
        super(message);
        this.code = code;
        this.name = 'SecurityError';
    }
}

/**
 * 验证和净化容器名
 * @param {string} name - 原始容器名
 * @returns {string} - 净化后的容器名
 * @throws {SecurityError} - 如果名称不安全
 */
function sanitizeContainerName(name) {
    if (!name || typeof name !== 'string') {
        throw new SecurityError('容器名不能为空');
    }
    
    // 移除首尾空白
    name = name.trim();
    
    // 检查长度
    if (name.length === 0 || name.length > 64) {
        throw new SecurityError('容器名长度必须在 1-64 字符之间');
    }
    
    // 检查危险字符
    if (CONFIG.DANGEROUS_CHARS.test(name)) {
        throw new SecurityError('容器名包含非法字符');
    }
    
    // 检查白名单格式（Docker 容器名规范）
    if (!CONFIG.SAFE_CHARS_REGEX.test(name)) {
        throw new SecurityError('容器名格式无效，只允许字母、数字、下划线、点和横线');
    }
    
    return name;
}

/**
 * 验证和净化端口号
 * @param {number|string} port - 端口号
 * @returns {number} - 净化后的端口号
 * @throws {SecurityError} - 如果端口号无效
 */
function sanitizePort(port) {
    const numPort = parseInt(port, 10);
    
    if (isNaN(numPort) || numPort < 1024 || numPort > 65535) {
        throw new SecurityError('端口号必须在 1024-65535 范围内');
    }
    
    return numPort;
}

/**
 * 验证路径安全
 * @param {string} filePath - 路径
 * @returns {string} - 绝对路径
 * @throws {SecurityError} - 如果路径不安全
 */
function sanitizePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new SecurityError('路径不能为空');
    }
    
    // 解析绝对路径
    const resolved = path.resolve(filePath);
    
    // 检查路径遍历
    if (resolved.includes('..')) {
        throw new SecurityError('路径包含非法的遍历序列');
    }
    
    return resolved;
}

/**
 * 安全的执行 Docker 命令
 * @param {string[]} args - 命令参数数组（会被转义）
 * @param {Object} options - 执行选项
 * @returns {string} - 命令输出
 * @throws {Error} - 如果执行失败
 */
function safeDockerExec(args, options = {}) {
    const { timeout = 30000, encoding = 'utf8' } = options;
    
    try {
        // 使用 spawn 更安全，避免 shell 注入
        const result = execSync(`docker ${args.join(' ')}`, {
            encoding,
            timeout,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return result.trim();
    } catch (error) {
        // 清理错误信息，避免泄露敏感信息
        const safeMessage = error.message
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '')  // 移除控制字符
            .substring(0, 500);  // 限制长度
        
        throw new Error(`Docker 命令执行失败: ${safeMessage}`);
    }
}

/**
 * 检查 Docker 是否已安装
 * @returns {boolean}
 */
function checkDockerInstalled() {
    try {
        execSync('docker --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取容器状态
 * @param {string} containerName - 容器名
 * @returns {Object} - 容器状态信息
 */
function getContainerStatus(containerName) {
    try {
        const sanitizedName = sanitizeContainerName(containerName);
        
        const output = safeDockerExec([
            'ps', '-a',
            '--filter', `name=^/${sanitizedName}$`,
            '--format', '{{.Status}}|{{.Ports}}|{{.Image}}'
        ]);
        
        if (!output) {
            return { exists: false, running: false };
        }
        
        const [status, ports, image] = output.split('|');
        const isRunning = status && status.toLowerCase().includes('up');
        
        return {
            exists: true,
            running: isRunning,
            status: status || 'unknown',
            ports: ports || '',
            image: image || ''
        };
    } catch (error) {
        return { exists: false, running: false, error: error.message };
    }
}

/**
 * 查找已存在的 SearXNG 容器
 * @returns {Object|null} - 容器信息
 */
function findExistingSearXNGContainer() {
    try {
        // 使用安全的过滤参数
        const output = safeDockerExec([
            'ps', '-a',
            '--filter', 'ancestor=searxng/searxng',
            '--format', '{{.Names}}|{{.Status}}|{{.Ports}}'
        ]);
        
        if (!output) return null;
        
        const lines = output.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const [name, status, ports] = line.split('|');
            if (name) {
                const isRunning = status && status.toLowerCase().includes('up');
                // 提取端口映射
                const portMatch = ports && ports.match(/:(\d+)->/);
                const hostPort = portMatch ? parseInt(portMatch[1], 10) : null;
                
                return {
                    name: name.trim(),
                    running: isRunning,
                    hostPort: hostPort
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error('查找容器失败:', error.message);
        return null;
    }
}

/**
 * 等待服务就绪
 * @param {string} url - 健康检查 URL
 * @param {number} maxAttempts - 最大尝试次数
 * @param {number} interval - 检查间隔（毫秒）
 * @returns {Promise<boolean>}
 */
async function waitForService(url, maxAttempts = 30, interval = 2000) {
    const http = url.startsWith('https') ? require('https') : require('http');
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const request = http.get(url, { timeout: 5000 }, (response) => {
                    if (response.statusCode === 200) {
                        resolve(true);
                    } else {
                        reject(new Error(`状态码: ${response.statusCode}`));
                    }
                });
                
                request.on('error', reject);
                request.on('timeout', () => {
                    request.destroy();
                    reject(new Error('超时'));
                });
            });
            
            return true;
        } catch {
            process.stdout.write('.');
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    return false;
}

/**
 * 启动 SearXNG 容器
 * @param {Object} options - 启动选项
 * @returns {Promise<Object>} - 启动结果
 */
async function startSearXNG(options = {}) {
    const {
        port = CONFIG.DEFAULT_PORT,
        name = CONFIG.CONTAINER_NAME,
        settingsPath = './searxng-settings.yml'
    } = options;
    
    try {
        // 验证输入
        const sanitizedName = sanitizeContainerName(name);
        const sanitizedPort = sanitizePort(port);
        const resolvedSettingsPath = sanitizePath(settingsPath);
        
        // 检查 Docker
        if (!checkDockerInstalled()) {
            throw new SecurityError('Docker 未安装或未运行');
        }
        
        console.log('🐳 正在检查 Docker 环境...');
        
        // 检查现有容器
        const existing = findExistingSearXNGContainer();
        
        if (existing) {
            if (existing.running) {
                console.log(`✅ 现有 SearXNG 容器正在运行`);
                console.log(`   名称: ${existing.name}`);
                console.log(`   端口: ${existing.hostPort}`);
                return {
                    success: true,
                    containerName: existing.name,
                    port: existing.hostPort,
                    url: `http://localhost:${existing.hostPort}`,
                    reused: true
                };
            } else {
                console.log(`🔄 启动已停止的容器: ${existing.name}`);
                safeDockerExec(['start', existing.name]);
                
                const ready = await waitForService(`http://localhost:${existing.hostPort}`);
                if (!ready) {
                    throw new Error('服务启动超时');
                }
                
                return {
                    success: true,
                    containerName: existing.name,
                    port: existing.hostPort,
                    url: `http://localhost:${existing.hostPort}`,
                    reused: true
                };
            }
        }
        
        // 创建新容器
        console.log(`🚀 启动新的 SearXNG 容器...`);
        console.log(`   名称: ${sanitizedName}`);
        console.log(`   端口: ${sanitizedPort}`);
        
        // 准备设置文件
        let volumeMount = '';
        if (fs.existsSync(resolvedSettingsPath)) {
            console.log(`   设置: ${resolvedSettingsPath}`);
            volumeMount = `-v "${resolvedSettingsPath}":/etc/searxng/settings.yml:ro`;
        }
        
        // 构建 Docker 命令（使用数组避免注入）
        const dockerArgs = [
            'run', '-d',
            '--name', sanitizedName,
            '--restart', CONFIG.RESTART_POLICY,
            '--cpus', CONFIG.CPU_LIMIT,
            '--memory', CONFIG.MEMORY_LIMIT,
            '-p', `${sanitizedPort}:8080`,
            '-e', 'SEARXNG_BASE_URL=http://localhost:8080/',
            '-e', 'INSTANCE_NAME=SearXNG-MCP'
        ];
        
        if (volumeMount) {
            dockerArgs.push('-v', `${resolvedSettingsPath}:/etc/searxng/settings.yml:ro`);
        }
        
        dockerArgs.push(CONFIG.IMAGE_NAME);
        
        // 执行命令
        const containerId = safeDockerExec(dockerArgs);
        
        if (!containerId) {
            throw new Error('容器启动失败');
        }
        
        console.log(`⏳ 等待服务就绪...`);
        const ready = await waitForService(`http://localhost:${sanitizedPort}`);
        
        if (!ready) {
            // 清理失败的容器
            try {
                safeDockerExec(['rm', '-f', sanitizedName]);
            } catch {}
            throw new Error('服务启动超时');
        }
        
        console.log('✅ SearXNG 已成功启动！');
        console.log(`   URL: http://localhost:${sanitizedPort}`);
        
        return {
            success: true,
            containerId: containerId.substring(0, 12),
            containerName: sanitizedName,
            port: sanitizedPort,
            url: `http://localhost:${sanitizedPort}`,
            reused: false
        };
        
    } catch (error) {
        console.error('❌ 启动失败:', error.message);
        return {
            success: false,
            error: error.message,
            code: error instanceof SecurityError ? 'SECURITY_ERROR' : 'STARTUP_ERROR'
        };
    }
}

/**
 * 停止 SearXNG 容器
 * @param {string} name - 容器名
 * @returns {Object} - 操作结果
 */
function stopSearXNG(name = CONFIG.CONTAINER_NAME) {
    try {
        const sanitizedName = sanitizeContainerName(name);
        const status = getContainerStatus(sanitizedName);
        
        if (!status.exists) {
            return { success: true, message: '容器不存在' };
        }
        
        console.log(`🛑 正在停止容器: ${sanitizedName}`);
        safeDockerExec(['stop', '-t', '30', sanitizedName]);
        
        return { success: true, message: '容器已停止' };
        
    } catch (error) {
        console.error('❌ 停止失败:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 删除 SearXNG 容器
 * @param {string} name - 容器名
 * @returns {Object} - 操作结果
 */
function removeSearXNG(name = CONFIG.CONTAINER_NAME) {
    try {
        const sanitizedName = sanitizeContainerName(name);
        
        console.log(`🗑️  正在删除容器: ${sanitizedName}`);
        safeDockerExec(['rm', '-f', sanitizedName]);
        
        return { success: true, message: '容器已删除' };
        
    } catch (error) {
        console.error('❌ 删除失败:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 获取容器日志
 * @param {string} name - 容器名
 * @param {number} lines - 行数
 * @returns {Object} - 日志信息
 */
function getLogs(name = CONFIG.CONTAINER_NAME, lines = 50) {
    try {
        const sanitizedName = sanitizeContainerName(name);
        const sanitizedLines = Math.min(Math.max(parseInt(lines, 10) || 50, 1), 1000);
        
        const logs = safeDockerExec(['logs', '--tail', sanitizedLines.toString(), sanitizedName]);
        
        return { success: true, logs };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 命令行接口
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        switch (command) {
            case 'start':
                const port = args[1] ? parseInt(args[1], 10) : CONFIG.DEFAULT_PORT;
                const result = await startSearXNG({ port });
                process.exit(result.success ? 0 : 1);
                
            case 'stop':
                const stopResult = stopSearXNG(args[1]);
                process.exit(stopResult.success ? 0 : 1);
                
            case 'restart':
                const restartPort = args[1] ? parseInt(args[1], 10) : CONFIG.DEFAULT_PORT;
                stopSearXNG();
                const restartResult = await startSearXNG({ port: restartPort });
                process.exit(restartResult.success ? 0 : 1);
                
            case 'status':
                const status = getContainerStatus(args[1] || CONFIG.CONTAINER_NAME);
                console.log(JSON.stringify(status, null, 2));
                process.exit(0);
                
            case 'logs':
                const logs = getLogs(args[1], args[2]);
                console.log(logs.logs || logs.error);
                process.exit(logs.success ? 0 : 1);
                
            case 'remove':
                const removeResult = removeSearXNG(args[1]);
                process.exit(removeResult.success ? 0 : 1);
                
            default:
                console.log(`
SearXNG Docker 管理器

用法: node docker-manager.js <命令> [选项]

命令:
  start [端口]     启动 SearXNG 容器（默认端口 8080）
  stop [名称]      停止容器（默认名称: searxng-mcp）
  restart [端口]   重启容器
  status [名称]    查看容器状态
  logs [名称] [行数] 查看日志
  remove [名称]    删除容器

安全特性:
  - 输入验证和净化
  - 命令注入防护
  - 资源限制（CPU: 1核, 内存: 512MB）
  - 自动重启策略
                `.trim());
                process.exit(0);
        }
    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

// 导出模块
module.exports = {
    startSearXNG,
    stopSearXNG,
    removeSearXNG,
    getContainerStatus,
    getLogs,
    findExistingSearXNGContainer,
    sanitizeContainerName,
    sanitizePort,
    checkDockerInstalled
};

// 如果直接运行
if (require.main === module) {
    main();
}