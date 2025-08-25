import { Agent, run, user, handoff,tool  } from '@openai/agents';
import { z } from 'zod';
import { removeAllTools } from '@openai/agents-core/extensions';

import { initializeAppHelperAgent } from './subagents/app_helper_agent.js';  
import { tracingProcessor } from './config.js';
import { switch_theme } from './main.js';
import { search_tool,extract_webcontent_tool,set_search_tool_key_TAVILY_API_KEY } from './subagents/public_tools.js';
import { logger } from './utils/logger.js';

// 添加 agent hooks 用于调试和监控
function attachHooks(agent) {
  let eventCounter = 0;
  let tokenCounter = 0;
  function toPrintableUsage(usage) {
    if (!usage) return 'No usage info';
    tokenCounter += usage.totalTokens ?? 0;
    return `tokens ${usage.totalTokens ?? 0}/${tokenCounter}`;
  }

  agent.on('agent_start', (ctx, agent) => {
    eventCounter++;
    logger.info(
      `${eventCounter}: ${agent.name} started. \n(${toPrintableUsage(ctx?.usage)})`
    );
  });
  agent.on('agent_end', (ctx, output) => {
    eventCounter++;
    logger.info(
      `${eventCounter}: ${agent.name} ended with output \n (${toPrintableUsage(ctx?.usage)})`
    );
    logger.debug(
      `\n ${JSON.stringify(output)}.`
    );
  });
  agent.on('agent_tool_start', (ctx, tool) => {
    eventCounter++;
    logger.info(
      `${eventCounter}: Tool ${tool.name} started. \n(${toPrintableUsage(ctx?.usage)})`
    );
  });
  agent.on('agent_tool_end', (ctx, tool, result) => {
    eventCounter++;
    logger.info(
      `${eventCounter}: Tool ${tool.name} ended with result \n(${toPrintableUsage(ctx?.usage)}).`
    );
    logger.debug(
      `\n ${JSON.stringify(result)}.`
    );
  });
  agent.on('agent_handoff', (ctx, nextAgent) => {
    eventCounter++;
    logger.info(
      `${eventCounter}: Handoff from ${agent.name} to ${nextAgent.name}. \n (${toPrintableUsage(ctx?.usage)})`
    );
  });
}

// ---
let chatbot_instructions = `
## 角色定义
您是多Agents协同的系统的入口agent，你优先自己解决问题，完成任务，如果有需要的话果断的把任务交给子agent。

## 工具使用
- [搜索工具]：使用tool(search_tool)来获取互联网上最新的资讯，你帮忙把对应url也返回给用户，方便用户点击跳转到浏览器查看
- [内容抓取]：使用tool(extract_webcontent_tool)来获取网页内容，当用户输入的内容中出现url时，使用该工具抓取页面内容并结合用户的意图来给用户回答
- [调试辅助]：使用tool(get_last_run_tracing for debugging)来获取上次运行的trace信息，整理一下逻辑流程，展示给开发者
- [调试辅助]：使用tool(get_messages_history_tool for debugging)来获取messages历史记录，整理一下流程，展示给用户，同时把内容格式化之后原样返回，如果遇到太长的文本，用省略号缩短。
- [应用设置]：使用tool(switch_theme_tool)来切换主题,直接切换，不要询问
- [应用设置]：使用tool(set_search_tool_key_TAVILY_API_KEY)来设置搜索工具 Tavily API Key
- [模型助手]：使用tool(switch_to_模型助手)来切换到模型配置助手,完成“模型列表查询”、“模型详情查询(by modelId)”、“模型切换(modelId)”、“当前模型配置查询”等任务

## 基本原则
- 使用中文进行交流,语言简练而优雅，结束时预测用户下一步的意图，并询问他的选择。在“回答用户的内容”和“询问用户下一步意图”之间区分一下。
- 当用户和你首次打招呼（Hi，你好，你会啥等等），主动介绍自己是多Agents协同的系统的入口agent，并根据上述的文档为用户提供使用指引，当用户回复数字时，他在选择对应的选项，请直接执行对应的操作。
`


// 创建OpenAI客户端（仅在配置有效时）
let main_agent = null;
let history = [];

let app_helper_agent = null;

const get_last_run_tracing_tool = tool({
  name: 'get_last_run_tracing',
  description: '获取上一次运行的追踪信息,json 格式 返回 tracing 详情',
  parameters: z.object({}),
  async execute({ }) {
    let tracingInfo = await tracingProcessor.getLastRunTracing();
    return JSON.stringify(tracingInfo, null, 2);
  },
});

const get_messages_history_tool = tool({
  name: 'get_messages_history',
  description: '获取 openai api 调用过程的 messages 历史记录',
  parameters: z.object({}),
  async execute({ }) {
    return JSON.stringify(history, null, 2);
  },
});

const switch_theme_tool = tool({
  name: 'switch_theme',
  description: '切换APP主题，暗黑→浅色 或者 浅色→暗黑',
  parameters: z.object({ }),
  async execute({ }) {
    return switch_theme();
  },
});



function initializeChatbot(config) {
    // add sub agents
    app_helper_agent = initializeAppHelperAgent(config.modelId);
    let handoffs = [handoff(app_helper_agent, {
                    inputFilter: removeAllTools,
                })];

    main_agent = new Agent({
        model: config.modelId,
        name: '助理',
        description: 'A helpful AI assistant chatbot',
        instructions: chatbot_instructions,

        tools: [get_last_run_tracing_tool, 
          get_messages_history_tool, 
          switch_theme_tool,
          search_tool,
          extract_webcontent_tool,
          set_search_tool_key_TAVILY_API_KEY
        ],

        handoffs: handoffs
    });

    // 添加主助手作为所有子助手的上游
    app_helper_agent.handoffs.push(handoff(main_agent, {
        inputFilter: removeAllTools,
        toolNameOverride: 'transform_to_default_agent'
    }));

    // 为 agents 添加 hooks 用于调试和监控
    attachHooks(main_agent);
    attachHooks(app_helper_agent);

    return true;
}


// ------
let last_result = null;
async function handleChatMessage(message) {
    try {
        history.push(user(message));

        let agent_to_run = main_agent;

        if (last_result && last_result.lastAgent) {
            agent_to_run = last_result.lastAgent;
        }

        tracingProcessor.start();
        const result = await run(agent_to_run, history, {
            maxTurns: 15  // Limit the conversation turns
        });
        tracingProcessor.shutdown();

        history = result.history;
        last_result = result;

        // 打印出当前是哪个助手
        let output_string = null;
        if (result.finalOutput && typeof result.finalOutput === 'string') {
          let prefix = '';
          if(agent_to_run == result.lastAgent) {
            prefix = agent_to_run.name;
          }else if(result.lastAgent) {
            prefix = agent_to_run.name + ' → ' + result.lastAgent.name;
          }
          output_string = prefix + ': ' + result.finalOutput;
        } 

        return output_string || result.output || '抱歉，模型现在无法回应，result.output == null。';
    } catch (error) {
        let userFriendlyError = `聊天机器人处理失败: ${error.message}`;
        throw new Error(userFriendlyError);
    }
}

// ------
function clearHistory() {
    history = [];
    last_result = null;
}


// Export the agent and functions for use in other modules
export { initializeChatbot, handleChatMessage, clearHistory };
