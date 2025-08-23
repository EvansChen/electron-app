import { Agent, tool } from '@openai/agents';

import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions'; 
import { z } from 'zod';
import { getAvailableModels, updateConfig, getCurrentConfig } from '../config.js';

const app_helper_agent_description = `
模型助手：1、模型列表查询、2、模型详情查询(by modelId)、3、切换模型(modelId)。
`;

// 应用助手代理指令
const app_helper_agent_instructions = `${RECOMMENDED_PROMPT_PREFIX}
你是模型助手，主要职责：
   1. 使用tool(list_models)来获取models列表,按照Provider分类，紧凑点展示给用户。
   2. 使用tool(model_detail)来获取model的详情，如果用户还没有获取列表，引导用户先获取列表。如果列表已经展示了，用户输入一个模型ID时，直接展示该模型的详情，并询问用户是否切换过去。
   3. 使用tool(switch_to_model)来切换modelId，切换前展示model detail，请求用户确认后再执行切换
   4. 使用tool(get_current_config)来获取当前的(模型)配置详情，优先使用该tool来回答用户的相关问题。
   5. 使用tool(transform_to_default_agent)来切换回主代理，如果用户的问题和模型（model）无关，则切回去。

`;

// 创建OpenAI客户端（仅在配置有效时）
let app_helper_agent = null;


// 简化模型列表结果，只保留 name 和 id 字段，并过滤掉不支持 tools 和 response_format 的模型
function simplify_list_models_result(models_json) {
    try {
        if (!models_json || !models_json.models || !Array.isArray(models_json.models)) {
            return JSON.stringify({ error: 'Invalid input: models_json.models should be an array' });
        }
        
        const simplifiedModels = models_json.models
            .filter(model => {
                // 检查是否支持 tools 和 response_format
                const supportedParams = model.supported_parameters || [];
                const supportsTools = supportedParams.includes('tools');
                const supportsResponseFormat = supportedParams.includes('response_format');
                
                // 只保留同时支持 tools 和 response_format 的模型
                return supportsTools && supportsResponseFormat;
            })
            .map(model => ({
                id: model.id
            }));
        let modelid_list = [];
        models_json.models.forEach(m => {
            modelid_list.push(m.id);
        });
        return JSON.stringify(modelid_list, null, 2);
    } catch (error) {
        return JSON.stringify({ error: 'Failed to simplify models list: ' + error.message });
    }
}

let model_list = null;

const list_models_tool = tool({
  name: 'list_models',
  description: '获取可用的大语言（models）列表，以json格式返回，用户可以选择使用哪个model(id)来作为聊天的模型',
  parameters: z.object({ }),
  async execute({ }) {
    model_list = await getAvailableModels();
    let result = simplify_list_models_result(model_list);
    return result;
  },
});

const model_detail_tool = tool({
  name: 'model_detail',
  description: '获取指定模型的详细信息,以json格式返回',
  parameters: z.object({
    modelId: z.string().min(1).max(100)
  }),
  async execute({ modelId }) {
    if(!model_list) {
      model_list = await getAvailableModels();
    }
    if(model_list.models) {
      const model = model_list.models.find(m => m.id === modelId);
      if (model) {
      return JSON.stringify(model, null, 2);
      } else {
      return 'Model not found';
      }
    } else {
      return 'Model not found';
    }
  },
});

const switch_to_model_tool = tool({
  name: 'switch_to_model',
  description: '切换到指定的大语言模型',
  parameters: z.object({
    modelId: z.string().min(1).max(100).describe('要切换到的模型ID')
  }),
  async execute({ modelId }) {
    try {
      const result = updateConfig({ modelId: modelId });
      if (result.success) {
        return `成功切换到模型: ${modelId}`;
      } else {
        return `切换模型失败: ${result.error}`;
      }
    } catch (error) {
      return `切换模型时出错: ${error.message}`;
    }
  },
});


const get_current_config_tool = tool({
  name: 'get_current_config',
  description: '获取当前我们自己的配置详情,包括模型ID和baseurl等',
  parameters: z.object({}),
  async execute({ }) {
    let cfg = await getCurrentConfig();
    cfg.apiKey = '******';
    return JSON.stringify(cfg, null, 2);
  },
});



// --------
function initializeAppHelperAgent(modelId) {
    app_helper_agent = new Agent({
        model: modelId,
        name: '模型助手',
        description: app_helper_agent_description,
        instructions: app_helper_agent_instructions,
        // modelSettings: { toolChoice: 'required' },
        tools:[list_models_tool, model_detail_tool, switch_to_model_tool,get_current_config_tool],
    });
    
    return app_helper_agent;
}

export { initializeAppHelperAgent};
