// 应用配置文件
export const APP_CONFIG = {
  // 窗口配置
  window: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true
  },
  
  // 开发配置
  development: {
    enableDevTools: process.env.NODE_ENV === 'development',
    enableLogging: true
  },
  
  // 路径配置
  paths: {
    frontend: '../frontend',
    assets: './assets',
    configs: process.env.APPDATA ? 
      `${process.env.APPDATA}/electron-app` : 
      `${process.env.HOME}/.electron-app`
  },
  
  // API 配置
  api: {
    timeout: 30000,
    retries: 3
  }
};
