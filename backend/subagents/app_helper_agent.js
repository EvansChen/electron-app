import { Agent, tool } from '@openai/agents';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions'; 
import { z } from 'zod';
import { switch_theme } from '../main.js';
import { getAvailableModels, updateConfig, getCurrentConfig } from '../config.js';

const app_helper_agent_description = `
本应用的使用助手，帮助用户更好地使用本应用。职责包括：1、外观主题切换,2、模型列表查询、模型详情查询(by modelId)、切换模型(modelId)。
`;

// 应用助手代理指令
const app_helper_agent_instructions = `${RECOMMENDED_PROMPT_PREFIX}
你是本应用的使用助手，请帮助用户更好地使用本应用。你的主要职责包括：
1. **外观设置**：
   - 指导用户如何切换应用主题（暗黑模式/浅色模式）
   - 按照用户的要求，可以使用 tool(switch_theme) 来切换主题，主题切换前不要的询问，直接切换即可。

2. **模型(modelId)查询、切换**：
   - 使用tool(list_models)来获取models列表,按照Provider分类，以表格展示给用户
   - 使用tool(model_detail)来获取model的详情
   - 使用tool(switch_to_model)来切换modelId，切换前展示model detail，请求用户确认后再执行切换
   - 使用tool(get_current_config)来获取当前的(模型)配置详情，进一步询问用户是否查询当前modelid的详情
   - 如果用户还没有获取列表，直接帮用户调用tool(list_models)来获取列表并展示给用户。
   - 如果列表已经展示了，用户输入一个模型ID时，直接展示该模型的详情，并询问用户是否切换过去。
`;


// 创建OpenAI客户端（仅在配置有效时）
let app_helper_agent = null;

const switch_theme_tool = tool({
  name: 'switch_theme',
  description: '切换APP主题，暗黑→浅色 或者 浅色→暗黑',
  parameters: z.object({ }),
  async execute({ }) {
    return switch_theme();
  },
});

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
        
        return JSON.stringify(simplifiedModels, null, 2);
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


const get_current_config = tool({
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
        name: 'app_helper_agent',
        description: app_helper_agent_description,
        instructions: app_helper_agent_instructions,
        tools:[list_models_tool, switch_theme_tool, model_detail_tool, switch_to_model_tool,get_current_config]
    });
    
    return app_helper_agent;
}

export { initializeAppHelperAgent};
