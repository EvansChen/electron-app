import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChatMessage, clearHistory } from './chatbot.js';
import { updateConfig, testModelConnection, getCurrentConfig, getAvailableModels, getConfigFilePath } from './config.js';

import { loadMcpConfig, saveMcpConfig, getCurrentMcpConfig, updateMcpConfig, getMcpConfigFilePath, initializeMcpServers, closeMcpServers, getConnectedMcpServers } from './mcpserver.js';
import { marked } from 'marked';

// 设置控制台编码为UTF-8（仅在Windows下）
if (process.platform === 'win32') {
    try {
        // 设置Node.js输出编码
        if (process.stdout.setEncoding) {
            process.stdout.setEncoding('utf8');
        }
        if (process.stderr.setEncoding) {
            process.stderr.setEncoding('utf8');
        }
        console.log('已设置控制台编码为UTF-8');
    } catch (error) {
        console.warn('设置编码失败:', error.message);
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 保持对窗口对象的全局引用，如果不这样做，当 JavaScript 对象被垃圾回收时，窗口会自动关闭。
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'), // 设置窗口图标
    autoHideMenuBar: true, // 隐藏菜单栏
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载应用的 index.html
  mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

  // 窗口最大化
  mainWindow.maximize();

  // 在调试模式下打开开发者工具
  // if (process.argv.includes('--inspect')) {
    // mainWindow.webContents.openDevTools();
  // }

  // 当窗口被关闭时，这个事件会被触发
  mainWindow.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    mainWindow = null;
  });
}

// Electron 会在初始化后并准备创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(createWindow);

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 通信处理 - 与聊天机器人交互
ipcMain.on('chatbot-message', async (event, message) => {
  try {
    // 调用 chatbot.js 脚本
    const response = await callChatbot(message);
    
    // 发送响应回渲染进程
    event.reply('chatbot-response', { message: response });
  } catch (error) {
    console.error('聊天机器人错误:', error);
    event.reply('chatbot-response', { error: error.message });
  }
});

// IPC 通信处理 - 清除聊天历史
ipcMain.on('clear-history', (event) => {
  try {
    clearHistory();
    event.reply('clear-history-response', { success: true });
  } catch (error) {
    console.error('清除历史错误:', error);
    event.reply('clear-history-response', { error: error.message });
  }
});

// IPC 通信处理 - 更新LLM配置
ipcMain.on('update-llm-config', (event, config) => {
  try {
    const result = updateConfig(config);
    event.reply('update-config-response', result);
  } catch (error) {
    console.error('更新配置错误:', error);
    event.reply('update-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 测试模型连通性
ipcMain.on('test-model-connection', async (event, config) => {
  try {
    const result = await testModelConnection(config);
    event.reply('test-connection-response', result);
  } catch (error) {
    console.error('测试连接错误:', error);
    event.reply('test-connection-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取当前配置
ipcMain.on('get-current-config', (event) => {
  try {
    const config = getCurrentConfig();
    event.reply('current-config-response', { success: true, config: config });
  } catch (error) {
    console.error('获取配置错误:', error);
    event.reply('current-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取可用模型列表
ipcMain.on('get-available-models', async (event, config) => {
  try {
    const result = await getAvailableModels(config);
    event.reply('available-models-response', result);
  } catch (error) {
    console.error('获取模型列表错误:', error);
    event.reply('available-models-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取配置文件路径
ipcMain.on('get-config-file-path', (event) => {
  try {
    const configPath = getConfigFilePath();
    event.reply('config-file-path-response', { success: true, path: configPath });
  } catch (error) {
    console.error('获取配置文件路径错误:', error);
    event.reply('config-file-path-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取当前MCP配置
ipcMain.on('get-current-mcp-config', (event) => {
  try {
    const config = getCurrentMcpConfig();
    event.reply('current-mcp-config-response', { success: true, config: config });
  } catch (error) {
    console.error('获取MCP配置错误:', error);
    event.reply('current-mcp-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 更新MCP配置
ipcMain.on('update-mcp-config', (event, config) => {
  try {
    const result = updateMcpConfig(config);
    event.reply('update-mcp-config-response', result);
  } catch (error) {
    console.error('更新MCP配置错误:', error);
    event.reply('update-mcp-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取MCP配置文件路径
ipcMain.on('get-mcp-config-file-path', (event) => {
  try {
    const configPath = getMcpConfigFilePath();
    event.reply('mcp-config-file-path-response', { success: true, path: configPath });
  } catch (error) {
    console.error('获取MCP配置文件路径错误:', error);
    event.reply('mcp-config-file-path-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取MCP配置
ipcMain.on('get-mcp-config', (event) => {
  try {
    const config = getCurrentMcpConfig();
    event.reply('mcp-config-response', { success: true, config: config });
  } catch (error) {
    console.error('获取MCP配置错误:', error);
    event.reply('mcp-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 保存MCP配置
ipcMain.on('save-mcp-config', (event, config) => {
  try {
    const result = saveMcpConfig(config);
    event.reply('mcp-config-save-response', { success: true, message: '配置保存成功' });
  } catch (error) {
    console.error('保存MCP配置错误:', error);
    event.reply('mcp-config-save-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 初始化MCP服务器
ipcMain.on('initialize-mcp-servers', async (event) => {
  try {
    const servers = await initializeMcpServers();
    event.reply('initialize-mcp-servers-response', { success: true, servers: servers });
  } catch (error) {
    console.error('初始化MCP服务器错误:', error);
    event.reply('initialize-mcp-servers-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取已连接的MCP服务器
ipcMain.on('get-connected-mcp-servers', (event) => {
  try {
    const servers = getConnectedMcpServers();
    event.reply('connected-mcp-servers-response', { success: true, servers: servers });
  } catch (error) {
    console.error('获取已连接MCP服务器错误:', error);
    event.reply('connected-mcp-servers-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 关闭MCP服务器连接
ipcMain.on('close-mcp-servers', async (event) => {
  try {
    await closeMcpServers();
    event.reply('close-mcp-servers-response', { success: true, message: '所有MCP服务器连接已关闭' });
  } catch (error) {
    console.error('关闭MCP服务器错误:', error);
    event.reply('close-mcp-servers-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 连接单个MCP服务器
ipcMain.on('connect-mcp-server', async (event, serverConfig) => {
  try {
    console.log('尝试连接MCP服务器:', serverConfig.name || serverConfig.id);
    
    // 检查必要的配置
    if (!serverConfig.baseUrl) {
      throw new Error('服务器配置缺少baseUrl');
    }
    
    // 动态导入MCPServerSSE
    const { MCPServerSSE } = await import('@openai/agents');
    
    // 创建MCP服务器实例
    const mcp = new MCPServerSSE({
      url: serverConfig.baseUrl,
      name: serverConfig.name || serverConfig.id,
      headers: serverConfig.headers || {},
      cacheToolsList: true,
    });

    // 连接服务器
    await mcp.connect();
    console.log(`成功连接到服务器: ${serverConfig.name || serverConfig.id}`);

    // 获取工具列表
    const tools = await mcp.listTools();
    console.log(`服务器 ${serverConfig.name || serverConfig.id} 的工具:`, tools);

    const result = {
      success: true,
      tools: tools || []
    };
    
    event.reply('connect-mcp-server-response', result);
  } catch (error) {
    console.error('连接MCP服务器错误:', {
      serverName: serverConfig.name || serverConfig.id,
      baseUrl: serverConfig.baseUrl,
      error: error.message,
      stack: error.stack
    });
    
    // 提供更详细的错误信息
    let errorMessage = error.message;
    if (error.code === 'ENOTFOUND') {
      errorMessage = '无法解析服务器地址，请检查URL是否正确';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = '连接被拒绝，请检查服务器是否启动';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '连接超时，请检查网络连接';
    } else if (error.code === 401 || error.message.includes('401')) {
      errorMessage = '身份验证失败，请检查API密钥是否正确';
    } else if (error.code === 403 || error.message.includes('403')) {
      errorMessage = '访问被拒绝，请检查API权限设置';
    } else if (error.code === 404 || error.message.includes('404')) {
      errorMessage = '服务器端点不存在，请检查URL路径';
    } else if (error.message.includes('Non-200 status code')) {
      const statusMatch = error.message.match(/\((\d+)\)/);
      const statusCode = statusMatch ? statusMatch[1] : 'unknown';
      errorMessage = `服务器返回错误状态码 ${statusCode}，请检查服务器配置和API密钥`;
    }
    
    event.reply('connect-mcp-server-response', { success: false, error: errorMessage });
  }
});

// IPC 通信处理 - 断开MCP服务器连接
ipcMain.on('disconnect-mcp-server', async (event, serverId) => {
  try {
    console.log('尝试断开MCP服务器连接:', serverId);
    
    // 这里可以调用断开服务器连接的逻辑
    // 目前只是返回成功，实际应用中可能需要维护连接状态
    
    event.reply('disconnect-mcp-server-response', { success: true });
    console.log('服务器断开连接成功:', serverId);
  } catch (error) {
    console.error('断开MCP服务器错误:', error);
    event.reply('disconnect-mcp-server-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 测试MCP工具
ipcMain.on('test-mcp-tool', async (event, options) => {
  try {
    // 这里可以调用实际的工具测试逻辑
    // 暂时返回模拟结果
    const result = {
      success: Math.random() > 0.3, // 70% 成功率
      data: `测试工具 ${options.toolName} 执行结果: ${JSON.stringify(options.parameters)}`
    };
    event.reply('test-mcp-tool-response', result);
  } catch (error) {
    console.error('测试MCP工具错误:', error);
    event.reply('test-mcp-tool-response', { success: false, error: error.message });
  }
});

// 调用聊天机器人函数
async function callChatbot(message) {
  try {
    // 直接调用 chatbot 模块的 handleChatMessage 函数
    const response = await handleChatMessage(message);
    
    // 将 markdown 格式的响应转换为 HTML
    const htmlResponse = marked(response);
    
    return htmlResponse;
  } catch (error) {
    console.error('聊天机器人处理错误:', error);
    throw new Error(`聊天机器人处理失败: ${error.message}`);
  }
}

// 在这个文件中，你可以包含应用程序剩余的所有部分的代码，
// 也可以把它们放在分离的文件中，然后用 require 导入。
