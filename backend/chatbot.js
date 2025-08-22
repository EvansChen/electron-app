import { Agent, run } from '@openai/agents';
import { initializeAppHelperAgent } from './subagents/app_helper_agent.js';  
import { tracingProcessor } from './config.js';

// ---
let chatbot_instructions = `
## 角色定义
您是多Agents协同的系统的入口agent，请优先把任务交给对应的子agent进行处理，下面是所有子agent的职责：
- 使用文档(app_helper_agent)：1、外观主题切换,2、模型可用列表查询、模型详情查询(by modelId)、切换模型(modelId),3、查看当前模型配置,4、获取上次运行的trace(debug)信息。

## 基本原则
- 使用中文进行交流
- 当用户和你首次打招呼（Hi，你好，你会啥等等），主动介绍自己是多Agents协同的系统的入口agent，并根据上述的文档为用户提供使用指引，当用户回复数字时，他可能在选择对应的选项。
`


// 创建OpenAI客户端（仅在配置有效时）
let main_agent = null;
let app_helper_agent = null;

function initializeChatbot(config) {
  app_helper_agent = initializeAppHelperAgent(config.modelId);
    main_agent = new Agent({
        model: config.modelId,
        name: 'ChatBot',
        description: 'A helpful AI assistant chatbot',
        instructions: chatbot_instructions,
        handoffs: [app_helper_agent]
    });

    return true;
}


// ------
let thread = [];
async function handleChatMessage(message) {
    try {
        thread = thread.concat({ role: 'user', content: message });
        tracingProcessor.start();
        const result = await run(main_agent, thread, {
            maxTurns: 15  // Limit the conversation turns
        });
        tracingProcessor.shutdown();

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
