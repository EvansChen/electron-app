import { tool } from '@openai/agents';
import { z } from 'zod';
import { tavily } from '@tavily/core';
import { getCurrentConfig,updateConfig } from '../config.js'; 

const set_search_tool_key_TAVILY_API_KEY = tool({
  name: 'set_search_tool_key_TAVILY_API_KEY',
  description: '设置 Tavily API Key',
  parameters: z.object({
    apiKey: z.string().min(1).max(100).describe('setting Tavily API Key'),
  }),
  async execute({ apiKey }) {
    try {
      const currentConfig = getCurrentConfig();
      currentConfig.search_tool.TAVILY_API_KEY = apiKey;
      return updateConfig(currentConfig);
    } catch (error) {
      return {
        success: false,
        error: error.message || '设置 TAVILY_API_KEY 失败'
      };
    }
  },
});

const search_tool = tool({
  name: 'search_tool',
  description: '搜索工具，使用 Tavily API 进行网络搜索',
  parameters: z.object({
    query: z.string().min(1).max(100).describe('搜索查询字符串'),
  }),
  async execute({ query }) {
    try {
      const currentConfig = getCurrentConfig();
      const apiKey = currentConfig.search_tool.TAVILY_API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        return { success: false, error: 'TAVILY_API_KEY 未设置, 请引导用户设置 tavily.com' };
      }

      const tvly = tavily({ apiKey });
      const response = await tvly.search(query);
      return response;

    } catch (error) {
      return {
        success: false,
        error: error.message || '搜索请求失败，可能是 TAVILY_API_KEY 未设置'
      };
    }
  },
});


const extract_webcontent_tool = tool({
  name: 'extract_webcontent_tool',
  description: '提取网页内容工具，使用 Tavily API 进行网页内容提取',
  parameters: z.object({
    url: z.string().min(1).max(100).describe('想要提取内容的网页的URL'),
  }),
  async execute({ url }) {
    try {
      const currentConfig = getCurrentConfig();
      const apiKey = currentConfig.search_tool.TAVILY_API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        return { success: false, error: 'TAVILY_API_KEY 未设置, 请引导用户设置 tavily.com' };
      }

      const tvly = tavily({ apiKey });
      const response = await tvly.extract(url);
      return response;

    } catch (error) {
      return {
        success: false,
        error: error.message || '提取失败，可能是 TAVILY_API_KEY 未设置'
      };
    }
  },
});

export { search_tool, extract_webcontent_tool, set_search_tool_key_TAVILY_API_KEY };