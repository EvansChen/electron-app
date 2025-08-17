import fs from 'fs';
import path from 'path';
import { app } from 'electron';

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
            // 返回默认配置
            const defaultConfig = {
                "mcpServers": {
                    "WebParser": {
                        "type": "sse",
                        "description": "网页解析（WebParser）MCP 服务，一个专用于网页内容解析的工具包。",
                        "isActive": true,
                        "name": "阿里云百炼_网页解析",
                        "baseUrl": "https://dashscope.aliyuncs.com/api/v1/mcps/WebParser/sse",
                        "headers": {
                            "Authorization": "Bearer sk-586c49520ce94f199c7f0f60ffa2befa"
                        }
                    }
                }
            };
            // 创建默认配置文件
            saveMcpConfig(defaultConfig);
            return defaultConfig;
        }
    } catch (error) {
        console.error('加载MCP配置失败:', error);
        console.error('配置文件路径:', getMcpConfigFilePath());
        // 返回默认配置
        return {
            "mcpServers": {
                "WebParser": {
                    "type": "sse",
                    "description": "网页解析（WebParser）MCP 服务，一个专用于网页内容解析的工具包。",
                    "isActive": true,
                    "name": "阿里云百炼_网页解析",
                    "baseUrl": "https://dashscope.aliyuncs.com/api/v1/mcps/WebParser/sse",
                    "headers": {
                        "Authorization": "Bearer sk-586c49520ce94f199c7f0f60ffa2befa"
                    }
                }
            }
        };
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

// 导出函数
export { 
    loadMcpConfig, 
    saveMcpConfig, 
    getCurrentMcpConfig, 
    updateMcpConfig, 
    getMcpConfigFilePath 
};