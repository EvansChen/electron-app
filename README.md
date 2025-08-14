# Electron 应用

一个使用 Electron 构建的简单桌面应用程序。

## 功能特性

- 现代化的用户界面
- 跨平台兼容（Windows、macOS、Linux）
- 基于 Node.js 和 Chromium
- 开发者工具集成

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动应用
```bash
npm start
```

### 3. 开发模式（带日志）
```bash
npm run dev
```

## 项目结构

```
electron-app/
├── main.js          # 主进程文件
├── index.html       # 渲染进程 HTML
├── package.json     # 项目配置
├── .gitignore       # Git 忽略文件
└── README.md        # 项目说明
```

## 技术栈

- **Electron**: 桌面应用程序框架
- **Node.js**: JavaScript 运行时
- **HTML/CSS/JavaScript**: 前端技术

## 开发指南

### 主要文件说明

- `main.js`: Electron 主进程，负责创建和管理应用窗口
- `index.html`: 应用的用户界面，运行在渲染进程中

### 自定义应用

1. 修改 `index.html` 来更改用户界面
2. 在 `main.js` 中配置窗口属性和应用行为
3. 添加更多的 JavaScript 文件来扩展功能

## 打包发布

要将应用打包为可执行文件，可以使用 `electron-builder` 或 `electron-packager`：

```bash
# 安装打包工具
npm install electron-builder --save-dev

# 打包应用
npm run build
```

## 许可证

MIT License
