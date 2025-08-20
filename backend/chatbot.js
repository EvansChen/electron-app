import 'dotenv/config';
import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';

// 创建OpenAI客户端（仅在配置有效时）
let agent = null;

function initializeChatbot(config) {
    agent = new Agent({
        model: config.modelId,
        name: 'ChatBot',
        description: 'A helpful AI assistant chatbot',
        instructions: 'You are a helpful AI assistant. Provide clear and concise answers to user questions in Chinese. Be friendly and helpful.',
    });
    
    return true;
}

let thread = [];

// 处理聊天消息的函数
async function handleChatMessage(message) {
    try {
        thread = thread.concat({ role: 'user', content: message });
        
        const result = await run(agent, thread, {
            maxTurns: 15  // Limit the conversation turns
        });

        thread = result.history;
        
        return result.finalOutput || result.output || '抱歉，模型现在无法回应。';
    } catch (error) {
        console.error('聊天机器人错误:', error);
        console.error('错误详情:', {
            message: error.message,
            status: error.status,
            code: error.code,
            type: error.type
        });
        
        let userFriendlyError = '聊天机器人处理失败';
        if (error.message.includes('401')) {
            userFriendlyError = 'API Key 无效或已过期，请检查配置';
        } else if (error.message.includes('404')) {
            userFriendlyError = '模型不存在或 Base URL 错误，请检查配置';
        } else if (error.message.includes('429')) {
            userFriendlyError = '请求频率过高，请稍后再试';
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
            userFriendlyError = '网络连接错误，请检查网络设置';
        } else {
            userFriendlyError = `聊天机器人处理失败: ${error.message}`;
        }
        
        throw new Error(userFriendlyError);
    }
}

// 清除聊天历史的函数
function clearHistory() {
    thread = [];
}


// Export the agent and functions for use in other modules
export { initializeChatbot, handleChatMessage, clearHistory};
