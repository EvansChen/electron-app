import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { MCPServerSSE } from '@openai/agents';

let mcpservers = [];


// 获取 MCP 服务器配置文件路径
function getMcpConfigFilePath() {
    try {
        // 在Electron环境中使用用户数据目录
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'mcpserver.json');
    } catch (error) {
        // 如果不在Electron环境中（比如测试时），回退到当前目录
        console.warn('不在Electron环境中，使用当前目录保存MCP配置:', error.message);
        return path.join(path.dirname(new URL(import.meta.url).pathname), 'mcpserver.json');
    }
}

// 加载保存的 MCP 服务器配置
function loadMcpConfig() {
    try {
        const configPath = getMcpConfigFilePath();
        console.log('尝试加载MCP配置文件:', configPath);
        
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            console.log('成功加载MCP配置');
            return JSON.parse(configContent);
        } else {
            console.log('MCP配置文件不存在，使用默认配置');
            // 返回空配置
            // 返回默认配置
            // 返回默认配置
            const defaultConfig = {
                "mcpServers": {}
            };
            // 创建默认配置文件
            saveMcpConfig(defaultConfig);
            return defaultConfig;
        }
    } catch (error) {
        console.error('加载MCP配置失败:', error);
        console.error('配置文件路径:', getMcpConfigFilePath());
        // 返回空配置
        return {"mcpServers": {}};
    }
}

// 保存 MCP 服务器配置
function saveMcpConfig(config) {
    try {
        const configPath = getMcpConfigFilePath();
        console.log('保存MCP配置到:', configPath);
        
        // 确保目录存在
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('MCP配置保存成功');
        return { success: true };
    } catch (error) {
        console.error('保存MCP配置失败:', error);
        return { success: false, error: error.message };
    }
}

// 获取当前 MCP 配置
function getCurrentMcpConfig() {
    return loadMcpConfig();
}

// 更新 MCP 配置
function updateMcpConfig(newConfig) {
    return saveMcpConfig(newConfig);
}

// 初始化 MCP 服务器
async function initializeMcpServers() {
    try {
        console.log('开始初始化MCP服务器...');
        
        // 从配置文件加载配置
        const config = loadMcpConfig();
        
        if (!config || !config.mcpServers) {
            console.log('没有找到MCP服务器配置');
            return [];
        }

        const servers = [];
        
        // 遍历配置中的每个服务器
        for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
            if (!serverConfig.isActive) {
                console.log(`跳过未激活的服务器: ${serverId}`);
                continue;
            }

            try {
                console.log(`初始化服务器: ${serverConfig.name || serverId}`);
                
                const mcp = new MCPServerSSE({
                    url: serverConfig.baseUrl,
                    name: serverConfig.name || serverId,
                    headers: serverConfig.headers || {},
                    // 可选：减少每次 list_tools 开销
                    cacheToolsList: true,
                });

                // 连接服务器
                await mcp.connect();
                console.log(`成功连接到服务器: ${serverConfig.name || serverId}`);

                // 获取工具列表
                const tools = await mcp.listTools();
                console.log(`服务器 ${serverConfig.name || serverId} 的工具:`, tools);

                servers.push({
                    id: serverId,
                    config: serverConfig,
                    server: mcp,
                    tools: tools
                });

            } catch (error) {
                console.error(`初始化服务器 ${serverId} 失败:`, error);
            }
        }

        mcpservers = servers;
        console.log(`成功初始化 ${servers.length} 个MCP服务器`);
        return servers;

    } catch (error) {
        console.error('初始化MCP服务器失败:', error);
        return [];
    }
}

// 关闭所有 MCP 服务器连接
async function closeMcpServers() {
    try {
        console.log('开始关闭MCP服务器连接...');
        
        for (const serverInfo of mcpservers) {
            try {
                await serverInfo.server.close();
                console.log(`已关闭服务器: ${serverInfo.config.name || serverInfo.id}`);
            } catch (error) {
                console.error(`关闭服务器 ${serverInfo.id} 失败:`, error);
            }
        }
        
        mcpservers = [];
        console.log('所有MCP服务器连接已关闭');
        
    } catch (error) {
        console.error('关闭MCP服务器连接失败:', error);
    }
}

// 获取所有已连接的 MCP 服务器
function getConnectedMcpServers() {
    return mcpservers;
}

// 导出函数
export { 
    loadMcpConfig, 
    saveMcpConfig, 
    getCurrentMcpConfig, 
    updateMcpConfig, 
    getMcpConfigFilePath,
    initializeMcpServers,
    closeMcpServers,
    getConnectedMcpServers
};