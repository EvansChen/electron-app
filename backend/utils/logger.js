import fs from 'fs';
import path from 'path';

class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.ensureLogDir();
    this.mainWindow = null; // 用于存储主窗口引用
    this.logHistory = []; // 存储最近的日志历史
    this.maxHistorySize = 1000; // 最大历史记录数
  }

  // 设置主窗口引用，用于发送日志到前端
  setMainWindow(window) {
    this.mainWindow = window;
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    }) + '\n';
  }

  // 发送日志到前端调试面板
  sendToDebugPanel(level, message, meta = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    };

    // 添加到历史记录
    this.logHistory.push(logData);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.splice(0, this.logHistory.length - this.maxHistorySize);
    }

    // 发送到前端（如果主窗口存在且未被销毁）
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('debug-log', logData);
      } catch (error) {
        console.error('Failed to send log to debug panel:', error);
      }
    }
  }

  // 获取日志历史记录
  getLogHistory() {
    return this.logHistory;
  }

  writeLog(level, message, meta = {}) {
    const logFile = path.join(this.logDir, `${level}.log`);
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // 异步写入文件
    fs.appendFile(logFile, formattedMessage, (err) => {
      if (err) console.error('Failed to write log:', err);
    });    
    // 发送到调试面板
    this.sendToDebugPanel(level, message, meta);
  }

  info(message, meta = {}) {
    this.writeLog('info', message, meta);
  }

  error(message, meta = {}) {
    this.writeLog('error', message, meta);
  }

  warn(message, meta = {}) {
    this.writeLog('warn', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('debug', message, meta);
    }
  }
}

export const logger = new Logger();
