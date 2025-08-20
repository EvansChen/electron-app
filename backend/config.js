import 'dotenv/config';
import { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import { initializeChatbot } from './chatbot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 获取用户数据目录，确保配置文件可写
function getConfigFilePath() {
    try {
        // 在Electron环境中使用用户数据目录
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'llm-config.json');
    } catch (error) {
        // 如果不在Electron环境中（比如测试时），回退到当前目录
        console.warn('不在Electron环境中，使用当前目录保存配置:', error.message);
        return path.join(__dirname, 'llm-config.json');
    }
}

const configFilePath = getConfigFilePath();

// 加载保存的配置
function loadSavedConfig() {
    try {
        const configPath = getConfigFilePath();
        console.log('尝试加载配置文件:', configPath);
        
        if (fs.existsSync(configPath)) {
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log('加载保存的配置成功:', {
                baseURL: savedConfig.baseURL,
                modelId: savedConfig.modelId,
                hasApiKey: !!savedConfig.apiKey
            });
            return savedConfig;
        } else {
            console.log('配置文件不存在:', configPath);
        }
    } catch (error) {
        console.error('加载配置文件失败:', error);
        console.error('配置文件路径:', getConfigFilePath());
    }
    return null;
}

// 保存配置到文件
function saveConfigToFile(config) {
    try {
        const configPath = getConfigFilePath();
        const configDir = path.dirname(configPath);
        
        // 确保配置目录存在
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            console.log('创建配置目录:', configDir);
        }
        
        // 保存配置文件
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('配置已保存到文件:', configPath);
        return true;
    } catch (error) {
        console.error('保存配置文件失败:', error);
        console.error('配置文件路径:', getConfigFilePath());
        console.error('错误详情:', {
            code: error.code,
            message: error.message,
            path: error.path
        });
        return false;
    }
}

// 默认配置 - 需要用户配置有效的API Key
let currentConfig = {
    apiKey: "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", // 需要用户配置
    baseURL: "https://openrouter.ai/api/v1",
    modelId: "qwen/qwen-2.5-3b-instruct" // 使用一个更常见的免费模型
};

// 在启动时加载保存的配置
const savedConfig = loadSavedConfig();
if (savedConfig) {
    currentConfig = { ...currentConfig, ...savedConfig };
    console.log('使用保存的配置:', {
        baseURL: currentConfig.baseURL,
        modelId: currentConfig.modelId,
        hasApiKey: !!currentConfig.apiKey
    });
} else {
    console.warn('未找到保存的配置，请在界面中配置API设置');
}

// 验证配置是否完整
function validateConfig(config = currentConfig) {
    const errors = [];
    
    if (!config.apiKey || config.apiKey.trim() === '') {
        errors.push('API Key 不能为空');
    }
    
    if (!config.baseURL || config.baseURL.trim() === '') {
        errors.push('Base URL 不能为空');
    }
    
    if (!config.modelId || config.modelId.trim() === '') {
        errors.push('模型 ID 不能为空');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// 创建OpenAI客户端（仅在配置有效时）
let client = null;
let agent = null;

function initializeClient() {
    const validation = validateConfig();
    if (validation.isValid) {
        client = new OpenAI({
            apiKey: currentConfig.apiKey,
            baseURL: currentConfig.baseURL,
        });

        setOpenAIAPI("chat_completions");
        setDefaultOpenAIClient(client); 
        setTracingDisabled(true);

        initializeChatbot(currentConfig);

        console.log('OpenAI 客户端和 Agent 初始化成功');
        return true;
    } else {
        console.log('配置不完整，跳过客户端初始化:', validation.errors);
        return false;
    }
}

// 尝试初始化客户端
initializeClient();

// 更新配置的函数
function updateConfig(newConfig) {
    try {
        console.log('更新LLM配置:', newConfig);
        
        // 更新配置对象
        if (newConfig.baseUrl) {
            currentConfig.baseURL = newConfig.baseUrl;
        }
        if (newConfig.apiKey) {
            currentConfig.apiKey = newConfig.apiKey;
        }
        if (newConfig.modelId) {
            currentConfig.modelId = newConfig.modelId;
        }
        
        // 保存配置到文件
        const configToSave = {
            apiKey: currentConfig.apiKey,
            baseURL: currentConfig.baseURL,
            modelId: currentConfig.modelId
        };
        
        const saved = saveConfigToFile(configToSave);
        if (!saved) {
            console.warn('配置保存失败，但仍会应用到当前会话');
        }
        
        // 重新初始化客户端和Agent
        const initialized = initializeClient();
        if (!initialized) {
            return { success: false, error: '配置不完整，无法初始化客户端' };
        }
        
        console.log('LLM配置更新成功');
        return { success: true, message: '配置更新成功并已保存' };
    } catch (error) {
        console.error('更新配置失败:', error);
        return { success: false, error: error.message };
    }
};

// 获取当前配置的函数
function getCurrentConfig() {
    return {
        apiKey: currentConfig.apiKey,
        baseURL: currentConfig.baseURL,
        modelId: currentConfig.modelId
    };
}

// 测试模型连通性的函数
async function testModelConnection(config) {
    try {
        console.log('测试模型连通性:', {
            baseURL: config.baseUrl || currentConfig.baseURL,
            modelId: config.modelId || currentConfig.modelId,
            apiKeyPrefix: (config.apiKey || currentConfig.apiKey) ? 
                (config.apiKey || currentConfig.apiKey).substring(0, 10) + '...' : 'undefined'
        });
        
        // 创建临时的OpenAI客户端进行测试
        const testClient = new OpenAI({
            apiKey: config.apiKey || currentConfig.apiKey,
            baseURL: config.baseUrl || currentConfig.baseURL,
            defaultHeaders: {
                'HTTP-Referer': 'https://localhost:3000', // 可选，用于openrouter.ai排名
                'X-Title': 'Electron Chat App', // 可选，用于openrouter.ai排名
            },
        });
        
        // 发送一个简单的测试消息
        const response = await testClient.chat.completions.create({
            model: config.modelId || currentConfig.modelId,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant. Please respond with "连接测试成功" to confirm the connection.'
                },
                {
                    role: 'user',
                    content: '测试连接'
                }
            ],
            max_tokens: 20,
            temperature: 0.1
        });
        
        const testMessage = response.choices[0]?.message?.content || '连接成功但响应为空';
        
        return {
            success: true,
            message: '模型连接测试成功！',
            response: testMessage,
            model: config.modelId || currentConfig.modelId,
            baseURL: config.baseUrl || currentConfig.baseURL
        };
        
    } catch (error) {
        console.error('模型连接测试失败:', error);
        console.error('错误详情:', {
            message: error.message,
            status: error.status,
            code: error.code,
            type: error.type
        });
        
        let errorMessage = '连接测试失败';
        if (error.message.includes('401') || error.status === 401) {
            errorMessage = 'API Key 无效、过期或权限不足';
        } else if (error.message.includes('404') || error.status === 404) {
            errorMessage = '模型ID不存在或Base URL错误';
        } else if (error.message.includes('429') || error.status === 429) {
            errorMessage = '请求频率过高，请稍后再试';
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
            errorMessage = '网络连接错误，请检查网络设置';
        } else if (error.message.includes('timeout')) {
            errorMessage = '请求超时，请检查网络连接';
        } else {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            error: errorMessage,
            details: error.message
        };
    }
}

// 获取可用模型列表
async function getAvailableModels(config = null) {
    try {
        const testConfig = config || currentConfig;
        console.log('获取模型列表，使用配置:', {
            baseURL: testConfig.baseUrl || testConfig.baseURL,
            hasApiKey: !!testConfig.apiKey
        });

        // 创建临时客户端
        const tempClient = new OpenAI({
            apiKey: testConfig.apiKey,
            baseURL: testConfig.baseUrl || testConfig.baseURL,
        });

        // 调用 models 端点
        const response = await tempClient.models.list();
        
        console.log('模型列表获取成功，模型数量:', response.data?.length || 0);
        
        return {
            success: true,
            models: response.data || [],
            baseURL: testConfig.baseUrl || testConfig.baseURL
        };
    } catch (error) {
        console.error('获取模型列表失败:', error);
        
        let errorMessage = '获取模型列表失败';
        if (error.message.includes('401') || error.status === 401) {
            errorMessage = 'API Key 无效、过期或权限不足';
        } else if (error.message.includes('404') || error.status === 404) {
            errorMessage = 'Models端点不存在或Base URL错误';
        } else if (error.message.includes('429') || error.status === 429) {
            errorMessage = '请求频率过高，请稍后再试';
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
            errorMessage = '网络连接错误，请检查网络设置';
        } else if (error.message.includes('timeout')) {
            errorMessage = '请求超时，请检查网络连接';
        } else {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            error: errorMessage,
            details: error.message
        };
    }
}

// Export the agent and functions for use in other modules
export { updateConfig, testModelConnection, getCurrentConfig, getAvailableModels, getConfigFilePath };
