import 'dotenv/config';
import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import OpenAI from "openai";

// using openrouter
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
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

// 处理聊天消息的函数
async function handleChatMessage(message) {
  try {
    const result = await run(agent, [
      {
        role: 'user',
        content: message
      }
    ], {
      maxTurns: 10  // Limit the conversation turns
    });
    
    return result.finalOutput || result.output || '抱歉，我现在无法回应。';
  } catch (error) {
    console.error('聊天机器人错误:', error);
    throw new Error(`聊天机器人处理失败: ${error.message}`);
  }
}

// 处理从标准输入读取的消息
async function processStdinMessage() {
  let inputData = '';
  
  // 读取标准输入
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', async (chunk) => {
    inputData += chunk;
  });
  
  process.stdin.on('end', async () => {
    try {
      const data = JSON.parse(inputData.trim());
      const message = data.message;
      
      if (!message) {
        console.log(JSON.stringify({ error: '消息不能为空' }));
        process.exit(1);
      }
      
      const response = await handleChatMessage(message);
      console.log(JSON.stringify({ message: response }));
      process.exit(0);
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    }
  });
}

// 环境变量方式处理消息（备用方案）
async function processEnvMessage() {
  const message = process.env.CHAT_MESSAGE;
  if (message) {
    try {
      const response = await handleChatMessage(message);
      console.log(JSON.stringify({ message: response }));
      process.exit(0);
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    }
  }
}

// 交互式聊天模式（当直接运行脚本时）
async function interactiveMode() {
  console.log('🤖 AI 聊天机器人已启动！输入 "exit" 退出。\n');
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '您: '
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const message = input.trim();
    
    if (message.toLowerCase() === 'exit') {
      console.log('再见！');
      rl.close();
      return;
    }
    
    if (message) {
      try {
        console.log('🤖 思考中...');
        const response = await handleChatMessage(message);
        console.log(`AI: ${response}\n`);
      } catch (error) {
        console.log(`错误: ${error.message}\n`);
      }
    }
    
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

// 主程序逻辑
async function main() {
  // 检查是否通过环境变量传递消息
  if (process.env.CHAT_MESSAGE) {
    await processEnvMessage();
    return;
  }
  
  // 检查是否有标准输入
  if (!process.stdin.isTTY) {
    await processStdinMessage();
    return;
  }
  
  // 否则进入交互模式
  await interactiveMode();
}

// Export the agent and functions for use in other modules
export { agent, handleChatMessage };

// 如果直接运行此文件，启动主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('程序启动失败:', error);
    process.exit(1);
  });
}
