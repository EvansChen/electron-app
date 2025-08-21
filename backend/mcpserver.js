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
        console.warn('Not in Electron environment, using current directory to save MCP configuration:', error.message);
        return path.join(path.dirname(new URL(import.meta.url).pathname), 'mcpserver.json');
    }
}

// 加载保存的 MCP 服务器配置
function loadMcpConfig() {
    try {
        const configPath = getMcpConfigFilePath();
        console.log('Attempting to load MCP configuration file:', configPath);
        
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            console.log('Successfully loaded MCP configuration');
            return JSON.parse(configContent);
        } else {
            console.log('MCP configuration file does not exist, using default configuration');
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
        console.error('Failed to load MCP configuration:', error);
        console.error('Configuration file path:', getMcpConfigFilePath());
        // 返回空配置
        return {"mcpServers": {}};
    }
}

// 保存 MCP 服务器配置
function saveMcpConfig(config) {
    try {
        const configPath = getMcpConfigFilePath();
        console.log('Saving MCP configuration to:', configPath);
        
        // 确保目录存在
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('MCP configuration saved successfully');
        return { success: true };
    } catch (error) {
        console.error('Failed to save MCP configuration:', error);
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
        console.log('Starting MCP server initialization...');
        
        // 从配置文件加载配置
        const config = loadMcpConfig();
        
        if (!config || !config.mcpServers) {
            console.log('No MCP server configuration found');
            return [];
        }

        const servers = [];
        
        // 遍历配置中的每个服务器
        for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
            if (!serverConfig.isActive) {
                console.log(`Skipping inactive server: ${serverId}`);
                continue;
            }

            try {
                console.log(`Initializing server: ${serverConfig.name || serverId}`);
                
                const mcp = new MCPServerSSE({
                    url: serverConfig.baseUrl,
                    name: serverConfig.name || serverId,
                    headers: serverConfig.headers || {},
                    // 可选：减少每次 list_tools 开销
                    cacheToolsList: true,
                });

                // 连接服务器
                await mcp.connect();
                console.log(`Successfully connected to server: ${serverConfig.name || serverId}`);

                // 获取工具列表
                const tools = await mcp.listTools();
                console.log(`Tools for server ${serverConfig.name || serverId}:`, tools);

                servers.push({
                    id: serverId,
                    config: serverConfig,
                    server: mcp,
                    tools: tools
                });

            } catch (error) {
                console.error(`Failed to initialize server ${serverId}:`, error);
            }
        }

        mcpservers = servers;
        console.log(`Successfully initialized ${servers.length} MCP servers`);
        return servers;

    } catch (error) {
        console.error('Failed to initialize MCP servers:', error);
        return [];
    }
}

// 关闭所有 MCP 服务器连接
async function closeMcpServers() {
    try {
        console.log('Starting to close MCP server connections...');
        
        for (const serverInfo of mcpservers) {
            try {
                await serverInfo.server.close();
                console.log(`Closed server: ${serverInfo.config.name || serverInfo.id}`);
            } catch (error) {
                console.error(`Failed to close server ${serverInfo.id}:`, error);
            }
        }
        
        mcpservers = [];
        console.log('All MCP server connections have been closed');
        
    } catch (error) {
        console.error('Failed to close MCP server connections:', error);
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