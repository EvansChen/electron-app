import 'dotenv/config';
import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';

// 创建OpenAI客户端（仅在配置有效时）
let main_agent = null;
let report = null;


function initializeChatbot(config) {
    main_agent = new Agent({
        model: config.modelId,
        name: 'ChatBot',
        description: 'A helpful AI assistant chatbot',
        instructions: 'You are a helpful AI assistant. Provide clear and concise answers to user questions in Chinese. Be friendly and helpful.',
    });
    
    return true;
}

let thread = [];

// ------
async function handleChatMessage(message) {
    try {
        thread = thread.concat({ role: 'user', content: message });
        
        const result = await run(main_agent, thread, {
            maxTurns: 15  // Limit the conversation turns
        });

        thread = result.history;
        
        return result.finalOutput || result.output || '抱歉，模型现在无法回应。';
    } catch (error) {
        let userFriendlyError = `聊天机器人处理失败: ${error.message}`;
        throw new Error(userFriendlyError);
    }
}

// ------
function clearHistory() {
    thread = [];
}


// Export the agent and functions for use in other modules
export { initializeChatbot, handleChatMessage, clearHistory};
