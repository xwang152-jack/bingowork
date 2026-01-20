<div align="center">
  <img src="./public/icon.png" width="120" height="120" alt="Bingowork Logo">

  # Bingowork

  ### 🤖 开源桌面级 AI 助手

  [![Release](https://img.shields.io/github/v/release/xwang152-jack/bingowork?style=flat-square&color=orange)](https://github.com/xwang152-jack/bingowork/releases)
  [![License](https://img.shields.io/github/license/xwang152-jack/bingowork?style=flat-square)](./LICENSE)

  **将您的电脑变成 AI 驱动的工作助手**

  支持任何具备 Agent 能力的模型（Claude、GPT、MiniMax 等）— 无厂商锁定
</div>

---

## ⚠️ 风险提示

**Bingowork 允许 AI 操作本地文件系统和终端，请务必注意：**

- AI 可能误删文件或执行错误命令
- 处理不受信任内容时可能存在提示词注入风险
- AI 可以读取授权目录内的所有文件

**安全建议：**
- ✅ 仅授权必要的目录
- ✅ 定期备份重要数据
- ✅ 批准操作前仔细审查
- ✅ 尽可能在沙盒环境中使用

> **免责声明：** 本软件按"原样"提供，仅供学习与开发用途。开发者不对使用本软件造成的任何损失承担责任。

---

## ✨ 核心特性

- 🤖 **模型通用** - 支持 Claude、GPT、MiniMax 等任何具备 Agent 能力的模型
- 📁 **文件操作** - AI 辅助读写、创建和修改本地文件
- 💻 **终端控制** - 安全执行命令行操作
- 🧩 **扩展能力** - 技能系统和 MCP 协议支持
- 🎨 **悬浮球** - `Alt+Space` 快捷键快速唤起
- 🔒 **安全优先** - 权限管理和授权系统
- 🌐 **跨平台** - 支持 Windows、macOS 和 Linux

---

## 🚀 快速开始

### 安装

从 [发布页面](https://github.com/xwang152-jack/bingowork/releases) 下载，或从源码构建：

```bash
git clone https://github.com/xwang152-jack/bingowork.git
cd bingowork
npm install
npm run dev
```

### 配置

1. **设置 API 密钥**
   - Claude：[Anthropic 控制台](https://console.anthropic.com/)
   - GPT：[OpenAI 平台](https://platform.openai.com/)
   - MiniMax：[MiniMax API](https://www.minimaxi.com/)

2. **授权目录** - 授予 AI 需要访问的文件夹权限

---

## 🏗️ 系统架构

**技术栈**：Electron 30+、React 18.2+、TypeScript 5.5+、Vite 5.1+、Tailwind CSS

**核心组件**：
- **AgentRuntime** - AI 对话和工具执行核心编排器
- **工具注册表** - 集中式工具管理与安全控制
- **技能系统** - 可扩展的技能框架
- **MCP 集成** - Model Context Protocol 支持

---

## 📖 文档

- [配置指南](./docs/configuration_cn.md)
- [开发指南](./docs/development_cn.md)
- [技能开发](./docs/skill-development.md)
- [MCP 集成](./docs/mcp-integration.md)

---

## 🧩 技能与扩展

### 内置技能

- **agent-browser** - 浏览器自动化测试和数据抓取
- **algorithmic-art** - 使用 p5.js 创建生成艺术
- **docx** - Microsoft Word 文档创建
- **pptx** - PowerPoint 演示文稿生成
- **slack-gif-creator** - Slack 动画 GIF 创建
- **web-artifacts-builder** - 基于 React 的 Web 工件

### 创建自定义技能

在 `~/.bingowork/skills/` 中创建新技能：

```markdown
---
name: my-skill
description: 对此技能功能的简要描述
---

# 我的技能

关于 AI 如何使用此技能的说明...
```

---

## 🌐 MCP 集成

Bingowork 支持 Model Context Protocol 以扩展 AI 能力。

### 配置方法

创建 `~/.bingowork/mcp.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/允许访问的文件/路径"]
    }
  }
}
```

---

## 🛠️ 开发

```bash
npm run dev          # 启动开发服务器
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查
npm run test         # 运行测试
npm run build        # 构建生产版本
```

---

## 📄 开源许可

MIT 许可证 - 详见 [LICENSE](./LICENSE) 文件。

---

<div align="center">

  [⬆ 返回顶部](#bingowork)

</div>
