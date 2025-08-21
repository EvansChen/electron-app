import 'dotenv/config';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { chatbot_instructions } from './prompts/instructions.js';
import { switch_theme } from './main.js';
// import { getAvailableModels } from './config.js';


// 创建OpenAI客户端（仅在配置有效时）
let main_agent = null;

const switch_theme_tool = tool({
  name: 'switch_theme',
  description: '切换APP主题，暗黑→浅色 或者 浅色→暗黑',
  parameters: z.object({ }),
  async execute({ }) {
    return switch_theme();
  },
});

function initializeChatbot(config) {
    main_agent = new Agent({
        model: config.modelId,
        name: 'ChatBot',
        description: 'A helpful AI assistant chatbot',
        instructions: chatbot_instructions,
        tools:[]
    });
    
    return true;
}


// ------
let thread = [];
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
