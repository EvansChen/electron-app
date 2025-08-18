import { jest } from '@jest/globals';

// Mock Electron API
global.require = jest.fn();
global.module = { exports: {} };

// Mock IPC
const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn(),
  maximize: jest.fn(),
  webContents: {
    openDevTools: jest.fn()
  },
  on: jest.fn()
}));

global.mockElectron = {
  app: {
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn()
  },
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain
};

// 设置测试超时
jest.setTimeout(30000);
