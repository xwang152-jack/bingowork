<div align="center">
  <img src="./public/icon.png" width="120" height="120" alt="Bingowork Logo">

  # Bingowork
  
  [简体中文](./README_CN.md)

  ### 🤖 Open Source Desktop AI Assistant

  [![Release](https://img.shields.io/github/v/release/xwang152-jack/bingowork?style=flat-square&color=orange)](https://github.com/xwang152-jack/bingowork/releases)
  [![License](https://img.shields.io/github/license/xwang152-jack/bingowork?style=flat-square)](./LICENSE)

  **Transform your PC into an AI-powered work assistant**

  Support any Agent-capable model (Claude, GPT, MiniMax, etc.) — No vendor lock-in
</div>

---

## ⚠️ Risk Notice

**Bingowork allows AI to operate on your local file system and terminal. Please be aware:**

- AI may accidentally delete files or execute incorrect commands
- Prompt injection risks may exist when processing untrusted content
- AI can read all files within authorized directories

**Safety Recommendations:**
- ✅ Only authorize necessary directories
- ✅ Backup important data regularly
- ✅ Review operation requests before approving
- ✅ Use in a sandboxed environment when possible

> **Disclaimer:** This software is provided "as-is" for learning and development purposes only. Developers are not liable for any losses caused by using this software.

---

## ✨ Features

- 🤖 **Model Agnostic** - Support for Claude, GPT, MiniMax, and any Agent-capable model
- 📁 **File Operations** - Read, write, create, and modify local files
- 💻 **Terminal Control** - Execute command-line operations safely
- 🧩 **Extensions** - Skills and MCP protocol support
- 🎨 **Floating Ball** - Quick access via `Alt+Space` hotkey
- 🔒 **Security First** - Permission management and authorization system
- 🌐 **Cross-Platform** - Windows, macOS, and Linux

---

## 🚀 Quick Start

### Installation

Download from [Releases](https://github.com/xwang152-jack/bingowork/releases) or build from source:

```bash
git clone https://github.com/xwang152-jack/bingowork.git
cd bingowork
npm install
npm run dev
```

### Configuration

1. **Set API Key** in Settings
   - Claude: [Anthropic Console](https://console.anthropic.com/)
   - GPT: [OpenAI Platform](https://platform.openai.com/)
   - MiniMax: [MiniMax API](https://www.minimaxi.com/)

2. **Authorize Directories** for AI to work with

---

## 🏗️ Architecture

**Tech Stack**: Electron 30+, React 18.2+, TypeScript 5.5+, Vite 5.1+, Tailwind CSS

**Core Components**:
- **AgentRuntime** - AI conversation and tool execution orchestrator
- **Tool Registry** - Centralized tool management with security
- **Skills System** - Extensible skill framework
- **MCP Integration** - Model Context Protocol support

---

## 📖 Documentation

- [Configuration Guide](./docs/configuration.md)
- [Development Guide](./docs/development.md)
- [Skill Development](./docs/skill-development.md)
- [MCP Integration](./docs/mcp-integration.md)

---

## 🧩 Skills & Extensions

### Built-in Skills

- **agent-browser** - Browser automation for testing and scraping
- **algorithmic-art** - Generative art using p5.js
- **docx** - Microsoft Word document creation
- **pptx** - PowerPoint presentation generation
- **slack-gif-creator** - Animated GIF creation for Slack
- **web-artifacts-builder** - React-based web artifacts

### Creating Custom Skills

Create a new skill in `~/.bingowork/skills/`:

```markdown
---
name: my-skill
description: A brief description of what this skill does
---

# My Skill

Instructions for the AI on how to use this skill...
```

---

## 🌐 MCP Integration

Bingowork supports the Model Context Protocol for extending AI capabilities.

### Configuration

Create `~/.bingowork/mcp.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    }
  }
}
```

---

## 🛠️ Development

```bash
npm run dev          # Start dev server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run build        # Build for production
```

---

## 📅 Changelog

### v1.0.10 (2026-02-07)
- 🐛 Fix: Corrected text alignment for user messages in chat interface

---


## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

<div align="center">

  [⬆ Back to Top](#bingowork)

</div>
