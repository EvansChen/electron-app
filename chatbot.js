import 'dotenv/config';
import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import OpenAI from "openai";

// using openrouter
const client = new OpenAI({
  apiKey: "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",
  baseURL: "https://openrouter.ai/api/v1",
});

setOpenAIAPI("chat_completions");
setDefaultOpenAIClient(client); 
setTracingDisabled(true);

const agent = new Agent({
  model: "openai/gpt-5-chat",
  name: 'ChatBot',
  description: 'A helpful AI assistant chatbot',
  instructions: 'You are a helpful AI assistant. Provide clear and concise answers to user questions in Chinese. Be friendly and helpful.',
});

let thread = [];

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

// Export the agent and functions for use in other modules
export { agent, handleChatMessage, clearHistory };
