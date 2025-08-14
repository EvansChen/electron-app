import 'dotenv/config';
import { Agent, run, setDefaultOpenAIClient,setOpenAIAPI,setTracingDisabled  } from '@openai/agents';
import OpenAI from "openai";

// using openrouter
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

setOpenAIAPI("chat_completions");
setDefaultOpenAIClient(client); 
setTracingDisabled(true);
// ...

const agent = new Agent({
  model: "openai/gpt-5-chat",
  name: 'ChatBot',
  description: 'A helpful AI assistant chatbot',
  instructions: 'You are a helpful AI assistant. Provide clear and concise answers to user questions. When you have provided a complete answer, end your response.',
});

// Example function to run the chatbot
async function startChatbot() {
  try {
    const result = await run(agent, [
      {
        role: 'user',
        content: '你好，请问你能帮我干啥?'
      }
    ], {
      maxTurns: 10  // Limit the conversation turns
    });
    
    console.log('Response:', result.finalOutput);
  } catch (error) {
    console.error('Error running chatbot:', error);
  }
}

// Export the agent and functions for use in other modules
export { agent, startChatbot };

// Run the chatbot if this file is executed directly
startChatbot();
