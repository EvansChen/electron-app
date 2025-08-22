import 'dotenv/config';
import { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled, setTraceProcessors } from '@openai/agents';
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import { initializeChatbot } from './chatbot.js';
import { config_updated } from './main.js' 

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TracingProcessor 实现，将跟踪信息写入到 tracing.log 文件
class FileTracingProcessor {
    constructor(logPath = 'tracing.log') {
        this.logPath = path.resolve(logPath);
        this.ensureLogFile();
        this.isActive = false;
    }

    ensureLogFile() {
        try {
            // 确保日志文件所在目录存在
            const logDir = path.dirname(this.logPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // 如果日志文件不存在，创建一个空文件
            if (!fs.existsSync(this.logPath)) {
                fs.writeFileSync(this.logPath, '', 'utf8');
                console.log(`Created tracing log file: ${this.logPath}`);
            }
        } catch (error) {
            console.error('Failed to ensure tracing log file:', error);
        }
    }

    formatLogEntry(type, data) {
        const timestamp = new Date().toISOString();
        return JSON.stringify({
            timestamp,
            type,
            ...data
        }) + '\n';
    }

    writeToLog(entry) {
        try {
            fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf8');
        } catch (error) {
            console.error('Failed to write trace to file:', error);
        }
    }

    // 可选的启动方法
    start() {
        this.isActive = true;
    }

    // 当 trace 开始时调用
    async onTraceStart(trace) {
        if (!this.isActive) return;
        this.writeToLog(trace);
    }

    // 当 trace 结束时调用
    async onTraceEnd(trace) {
        if (!this.isActive) return;
        this.writeToLog(trace);
    }

    // 当 span 开始时调用
    async onSpanStart(span) {
        if (!this.isActive) return;
        this.writeToLog(span);
    }

    async onSpanEnd(span) {
        if (!this.isActive) return;
        this.writeToLog(span);
    }

    async forceFlush() {}

    async shutdown(timeout) {
        this.isActive = false;
    }
}

// 创建 TracingProcessor 实例
const tracingProcessor = new FileTracingProcessor();



// 获取用户数据目录，确保配置文件可写
function getConfigFilePath() {
    try {
        // 在Electron环境中使用用户数据目录
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'llm-config.json');
    } catch (error) {
        // 如果不在Electron环境中（比如测试时），回退到当前目录
        console.warn('Not in Electron environment, using current directory to save configuration:', error.message);
        return path.join(__dirname, 'llm-config.json');
    }
}

const configFilePath = getConfigFilePath();

// 加载保存的配置
function loadSavedConfig() {
    try {
        const configPath = getConfigFilePath();
        
        if (fs.existsSync(configPath)) {
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return savedConfig;
        } else {
            console.log('Configuration file does not exist:', configPath);
        }
    } catch (error) {
        console.error('Failed to load configuration file:', error);
        console.error('Configuration file path:', getConfigFilePath());
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
            console.log('Configuration directory created:', configDir);
        }
        
        // 保存配置文件
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Configuration saved to file:', configPath);
        return true;
    } catch (error) {
        console.error('Failed to save configuration file:', error);
        console.error('Configuration file path:', getConfigFilePath());
        console.error('Error details:', {
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
} else {
    console.warn('No saved configuration found, please configure API settings in the interface');
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
        
        // 启用跟踪并设置我们的 TracingProcessor
        setTracingDisabled(false);
        setTraceProcessors([tracingProcessor]);
        
        initializeChatbot(currentConfig)

        return true;
    } else {
        console.log('Configuration is incomplete, skipping client initialization:', validation.errors);
        return false;
    }
}

// 更新配置的函数
function updateConfig(newConfig) {
    try {
        console.log('Updating LLM configuration:', newConfig);
        
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
            console.warn('Configuration save failed, but it will still apply to the current session');
        }
        
        // 重新初始化客户端和Agent
        const initialized = initializeClient();
        
        if (!initialized) {
            return { success: false, error: 'Configuration is incomplete, unable to initialize client' };
        }

        config_updated();

        return { success: true, message: 'Configuration updated successfully and saved' };
    } catch (error) {
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
        console.log('Testing model connectivity:', {
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
        console.error('Model connection test failed:', error);
        console.error('error detail:', {
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
        // 创建临时客户端
        const tempClient = new OpenAI({
            apiKey: testConfig.apiKey,
            baseURL: testConfig.baseUrl || testConfig.baseURL,
        });

        // 调用 models 端点
        const response = await tempClient.models.list();
                
        return {
            success: true,
            models: response.data || [],
            baseURL: testConfig.baseUrl || testConfig.baseURL
        };
    } catch (error) {
        console.error('Failed to retrieve model list:', error);
        
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
export { updateConfig, testModelConnection, getCurrentConfig, getAvailableModels, getConfigFilePath, initializeClient, tracingProcessor };
