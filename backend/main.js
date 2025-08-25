import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import './deepseek-compatibility.js'; // DeepSeek API 兼容层
import { handleChatMessage, clearHistory, getHistory } from './chatbot.js';
import { updateConfig, testModelConnection, getCurrentConfig, getAvailableModels, getConfigFilePath,initializeClient } from './config.js';
import { logger } from './utils/logger.js';
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
    } catch (error) {
        console.warn('Failed:', error.message);
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 保持对窗口对象的全局引用，如果不这样做，当 JavaScript 对象被垃圾回收时，窗口会自动关闭。
let mainWindow;

function createWindow() {
    initializeClient();

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

  // 设置logger的主窗口引用，用于发送日志到前端
  logger.setMainWindow(mainWindow);

  // 窗口加载完成后发送测试日志
  mainWindow.webContents.once('did-finish-load', () => {
    logger.debug('ready');
  });

  // 拦截所有新窗口和导航请求，在外部浏览器中打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 在系统默认浏览器中打开链接
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 拦截导航事件，防止在应用内导航到外部链接
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // 如果不是file协议（本地文件），则在外部浏览器打开
    if (parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

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
    console.error('Chatbot error:', error);
    event.reply('chatbot-response', { error: error.message });
  }
});

// IPC 通信处理 - 清除聊天历史
ipcMain.on('clear-history', (event) => {
  try {
    clearHistory();
    event.reply('clear-history-response', { success: true });
  } catch (error) {
    console.error('Clear history error:', error);
    event.reply('clear-history-response', { error: error.message });
  }
});

// IPC 通信处理 - 获取聊天历史
ipcMain.on('get-chat-history', (event) => {
  try {
    const history = getHistory();
    event.reply('chat-history-response', { history: history });
  } catch (error) {
    console.error('Get chat history error:', error);
    event.reply('chat-history-response', { error: error.message, history: [] });
  }
});

// IPC 通信处理 - 更新LLM配置
ipcMain.on('update-llm-config', (event, config) => {
  try {
    const result = updateConfig(config);
    event.reply('update-config-response', result);
  } catch (error) {
    console.error('Update configuration error:', error);
    event.reply('update-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 测试模型连通性
ipcMain.on('test-model-connection', async (event, config) => {
  try {
    const result = await testModelConnection(config);
    event.reply('test-connection-response', result);
  } catch (error) {
    console.error('Test connection error:', error);
    event.reply('test-connection-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取当前配置
ipcMain.on('get-current-config', (event) => {
  try {
    const config = getCurrentConfig();
    event.reply('current-config-response', { success: true, config: config });
  } catch (error) {
    console.error('Get configuration error:', error);
    event.reply('current-config-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 获取可用模型列表
ipcMain.on('get-available-models', async (event, config) => {
  try {
    const result = await getAvailableModels(config);
    event.reply('available-models-response', result);
  } catch (error) {
    console.error('Get available models error:', error);
    event.reply('available-models-response', { success: false, error: error.message });
  }
});



// IPC 通信处理 - 获取配置文件路径
ipcMain.on('get-config-file-path', (event) => {
  try {
    const configPath = getConfigFilePath();
    event.reply('config-file-path-response', { success: true, path: configPath });
  } catch (error) {
    console.error('Get config file path error:', error);
    event.reply('config-file-path-response', { success: false, error: error.message });
  }
});

// IPC 通信处理 - 请求调试日志历史
ipcMain.on('request-debug-logs', (event) => {
  try {
    const logHistory = logger.getLogHistory();
    event.reply('debug-logs-history', logHistory);
  } catch (error) {
    console.error('Get debug logs error:', error);
    event.reply('debug-logs-history', []);
  }
});

// IPC 通信处理 - 打开开发者工具
ipcMain.on('open-devtools', (event) => {
  try {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.openDevTools();
      logger.debug('开发者工具已打开');
    }
  } catch (error) {
    console.error('打开开发者工具失败:', error);
    logger.error('打开开发者工具失败: ' + error.message);
  }
});

// 调用聊天机器人函数
async function callChatbot(message) {
  try {
    // 直接调用 chatbot 模块的 handleChatMessage 函数
    const response = await handleChatMessage(message);
    
    // 配置 marked 选项和自定义渲染器
    const renderer = new marked.Renderer();
    
    // 重写链接渲染器以添加安全属性
    renderer.link = function(token) {
      // 处理新版本marked的token对象结构
      const href = token?.href || token || '';
      const title = token?.title || '';
      const text = token?.text || token?.raw || '';
      
      // 安全检查，确保href不为undefined
      if (!href || href === 'undefined') {
        console.warn('Link href is undefined:', token);
        return text; // 如果链接无效，只返回文本
      }
      
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    };

    // 配置 marked 选项
    marked.setOptions({
      breaks: true,  // 支持换行
      gfm: true,     // 支持 GitHub Flavored Markdown
      sanitize: false,  // 不清理 HTML，允许更好的格式化
      smartLists: true, // 智能列表处理
      smartypants: false, // 关闭智能标点符号，避免冲突
      renderer: renderer
    });
    
    // 将 markdown 格式的响应转换为 HTML
    const htmlResponse = marked(response);
    
    return htmlResponse;
  } catch (error) {
    console.error('Chatbot processing error:', error);
    throw new Error(`聊天机器人处理失败: ${error.message}`);
  }
}

// 在这个文件中，你可以包含应用程序剩余的所有部分的代码，
// 也可以把它们放在分离的文件中，然后用 require 导入。

function switch_theme(){
  // 直接调用主窗口的主题切换功能
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript('toggleTheme()');
      console.log('主题切换成功');
      return { success: true };
    } catch (error) {
      console.error('Theme switch error:', error);
      return { success: false, error: error.message };
    }
  } else {
    console.error('Main window unavailable');
    return { success: false, error: '主窗口不可用' };
  }
}

function config_updated() {
  // 直接调用主窗口的配置更新功能
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript('updateConfig()');
      return { success: true };
    } catch (error) {
      console.error('Config update error:', error);
      return { success: false, error: error.message };
    }
  } else {
    console.error('Main window unavailable');
    return { success: false, error: '主窗口不可用' };
  }
}

// 导出函数以便其他模块使用
export { switch_theme, config_updated };
