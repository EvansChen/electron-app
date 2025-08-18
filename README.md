# Electron Chat App

一个基于 Electron 的智能聊天应用，支持多种 AI 模型和 MCP (Model Context Protocol) 服务器。

## 🚀 功能特性

- 🤖 支持多种 AI 模型（OpenAI、Anthropic、Google Gemini 等）
- 🔌 MCP 服务器集成支持
- 💬 实时聊天界面
- ⚙️ 灵活的配置管理
- 🎨 现代化 UI 设计

## 📁 项目结构

```
electron-app/
├── backend/          # 后端代码
│   ├── core/         # 核心逻辑
│   ├── utils/        # 工具函数
│   └── assets/       # 资源文件
├── frontend/         # 前端代码
│   ├── pages/        # 页面
│   ├── components/   # 组件
│   └── styles/       # 样式
├── config/           # 配置文件
├── tests/            # 测试文件
└── docs/             # 文档
```

## 🛠️ 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 运行开发环境

```bash
npm run dev
```

### 构建应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 🧪 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch

# 代码检查
npm run lint
```

## 📖 使用说明

1. 启动应用
2. 配置 AI 模型和 API 密钥
3. 可选：配置 MCP 服务器
4. 开始聊天

## 🔧 配置

应用配置文件位于用户数据目录：
- Windows: `%APPDATA%/electron-app/`
- macOS: `~/Library/Application Support/electron-app/`
- Linux: `~/.config/electron-app/`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
