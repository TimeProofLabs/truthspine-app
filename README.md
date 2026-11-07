<p align="center"><img src="media/truthspine-logo.png" alt="TruthSpine" width="96"></p>

# TruthSpine

**Stop re-explaining your project to every new AI chat. It works on your computer, with no cloud account and nothing extra to install.**

Every connected chat checks your project before it answers, so you never re-explain it. TruthSpine keeps one checked record of what was decided, what was done, what failed, and what comes next.

You lead the work. TruthSpine keeps the truth.

![A TruthSpine project page: what your chats just saved, the project's truth, and numbered next work](media/truthspine-project.png)

## Get it

| | |
| --- | --- |
| **Windows** | [Microsoft Store](https://apps.microsoft.com/detail/9pbn25k75vdj) |
| **Mac** | [Mac App Store](https://apps.apple.com/app/id6794478470) |
| **Linux** | [AppImage](https://truthspine.app/download/linux) from this repository's [releases](https://github.com/TimeProofLabs/truthspine-app/releases) |

## Connect your AI apps

Open TruthSpine and go to **Connections**. It lists the AI apps on your computer as Connected, Ready or Not installed, and sets each one up for you. Then, in a new chat, say **"Connect TruthSpine"**. The chat now knows your project: the current decisions, what was done, and what comes next.

You can also add TruthSpine from your tool:

- **Claude Code:** `/plugin marketplace add TimeProofLabs/truthspine-app`, then `/plugin install truthspine@timeprooflabs`
- **Cursor:** add TruthSpine from the Cursor Marketplace
- **VS Code and Open VSX editors:** "TruthSpine - Project Memory for AI Coding Agents" from the Visual Studio Marketplace or Open VSX
- **JetBrains IDEs:** "TruthSpine - Project Memory for AI Coding Agents" from JetBrains Marketplace
- **Any other MCP tool:** a server named `truthspine` that runs `npx -y @timeprooflabs/truthspine-mcp --host <tool> --project <folder>`
- **MCP Registry:** `app.truthspine/truthspine`

Every tool and how to connect it: [CONNECT.md](CONNECT.md). Each one needs the TruthSpine app on the same computer.

## What it does for you

- You decide once, and every chat follows it.
- It tells what a chat says it did apart from what your files prove.
- It shows what is true now, and it sets older decisions aside.
- It remembers what failed, so the next chat knows.
- It remembers your accounts, services and preferences, and it holds back passwords and keys.
- It sorts out disagreements between chats, and it asks you only when the decision is yours.
- It handles big, messy projects without slowing down.
- You set a rule once, and every project follows it.
- You can download the full history any time.
- Only the folder you said yes to is connected, and TruthSpine never looks through the rest of your computer.
- Your project stays on your computer, and a cloud agent sees it only if you connect one and say what it may do.

It works with 19 AI apps on Windows: VS Code with GitHub Copilot Chat, Claude Desktop, Claude Code, Cursor, Codex, Google Antigravity, Windsurf / Devin, Open WebUI, LM Studio, Cline, Kiro, JetBrains IDEs, Zed, Hermes Agent, OpenClaw, OpenCode, GitHub Copilot CLI, Droid and Pi. On Mac and Linux it works with 18 AI apps, the same list without Open WebUI.

Cloud agents such as ChatGPT, Claude, Meta Muse and Grok reach your project through a private connection in your own free Cloudflare account, while TruthSpine is open.

## About this repository

This is TruthSpine's public home: the connectors, release notes, support and discussion, and the Linux AppImage on [releases](https://github.com/TimeProofLabs/truthspine-app/releases). The app itself comes from the Microsoft Store, the Mac App Store or the Linux AppImage. Its source code is not published.

**License:** Apache-2.0 for this repository's contents (connectors and docs). See [LICENSE](LICENSE). The TruthSpine app is closed source.

## Help

- [Report a problem](https://github.com/TimeProofLabs/truthspine-app/issues/new/choose)
- [Ask a question or share an idea](https://github.com/TimeProofLabs/truthspine-app/discussions)
- [Privacy](https://truthspine.app/privacy) · [Security](https://truthspine.app/security) · [Support](https://truthspine.app/support)
- Email: support@truthspine.app
