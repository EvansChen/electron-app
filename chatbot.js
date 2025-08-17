import 'dotenv/config';
import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configFilePath = path.join(__dirname, 'llm-config.json');

// 加载保存的配置
function loadSavedConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            const savedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
            console.log('加载保存的配置:', savedConfig);
            return savedConfig;
        }
    } catch (error) {
        console.error('加载配置文件失败:', error);
    }
    return null;
}

// 保存配置到文件
function saveConfigToFile(config) {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
        console.log('配置已保存到文件:', configFilePath);
        return true;
    } catch (error) {
        console.error('保存配置文件失败:', error);
        return false;
    }
}

// 默认配置
let currentConfig = {
    apiKey: "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",
    baseURL: "https://openrouter.ai/api/v1",
    modelId: "openai/gpt-5-chat"
};

// 在启动时加载保存的配置
const savedConfig = loadSavedConfig();
if (savedConfig) {
    currentConfig = { ...currentConfig, ...savedConfig };
    console.log('使用保存的配置:', currentConfig);
}

// 创建OpenAI客户端
let client = new OpenAI({
    apiKey: currentConfig.apiKey,
    baseURL: currentConfig.baseURL,
});

setOpenAIAPI("chat_completions");
setDefaultOpenAIClient(client); 
setTracingDisabled(true);

// 创建Agent
let agent = new Agent({
    model: currentConfig.modelId,
    name: 'ChatBot',
    description: 'A helpful AI assistant chatbot',
    instructions: 'You are a helpful AI assistant. Provide clear and concise answers to user questions in Chinese. Be friendly and helpful.',
});

let thread = [];

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
        
        // 重新创建OpenAI客户端
        client = new OpenAI({
            apiKey: currentConfig.apiKey,
            baseURL: currentConfig.baseURL,
        });
        
        // 重新设置默认客户端
        setDefaultOpenAIClient(client);
        
        // 重新创建Agent
        agent = new Agent({
            model: currentConfig.modelId,
            name: 'ChatBot',
            description: 'A helpful AI assistant chatbot',
            instructions: 'You are a helpful AI assistant. Provide clear and concise answers to user questions in Chinese. Be friendly and helpful.',
        });
        
        console.log('LLM配置更新成功');
        return { success: true, message: '配置更新成功并已保存' };
    } catch (error) {
        console.error('更新配置失败:', error);
        return { success: false, error: error.message };
    }
};

// 处理聊天消息的函数
async function handleChatMessage(message) {
    try {
        thread = thread.concat({ role: 'user', content: message });
        
        const result = await run(agent, thread, {
            maxTurns: 10  // Limit the conversation turns
        });
        
        thread = result.history;
        
        return result.finalOutput || result.output || '抱歉，我现在无法回应。';
    } catch (error) {
        console.error('聊天机器人错误:', error);
        throw new Error(`聊天机器人处理失败: ${error.message}`);
    }
}

// 清除聊天历史的函数
function clearHistory() {
    thread = [];
    console.log('聊天历史已清除');
}

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
        console.log('测试模型连通性:', config);
        
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
        
        let errorMessage = '连接测试失败';
        if (error.message.includes('401')) {
            errorMessage = 'API Key 无效或过期';
        } else if (error.message.includes('404')) {
            errorMessage = '模型ID不存在或Base URL错误';
        } else if (error.message.includes('429')) {
            errorMessage = '请求频率过高，请稍后再试';
        } else if (error.message.includes('network')) {
            errorMessage = '网络连接错误，请检查网络设置';
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
export { agent, handleChatMessage, clearHistory, updateConfig, testModelConnection, getCurrentConfig };
