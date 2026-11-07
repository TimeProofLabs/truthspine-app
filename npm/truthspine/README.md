# TruthSpine MCP connector (npm)

[![npm version](https://img.shields.io/npm/v/truthspine)](https://www.npmjs.com/package/truthspine) [![weekly downloads](https://img.shields.io/npm/dw/truthspine)](https://www.npmjs.com/package/truthspine) [![license](https://img.shields.io/npm/l/truthspine)](LICENSE)

The free MCP connector for TruthSpine, the local-first project-truth app for AI agents.

Stop re-explaining your project to every new AI chat. It works on your computer, with no cloud account and nothing extra to install.

One checked record of what was decided, what was done, what failed and what comes next. Every connected chat checks your project before it answers, so you never re-explain it. Your project stays on your computer.

This is the free connector. It needs the TruthSpine desktop app installed on the same computer: the [Microsoft Store](https://apps.microsoft.com/detail/9pbn25k75vdj) on Windows, the [Mac App Store](https://apps.apple.com/app/id6794478470) on macOS, or the AppImage from [truthspine.app](https://truthspine.app/download) on Linux.

## See it

![Codex in VS Code is asked what was decided for custom cake orders and answers from TruthSpine's saved record: $39.](https://truthspine.app/media/listing/truthspine-codex-demo.gif)

*Codex in VS Code. Real recording, waits shortened.*

![Every new chat makes me explain the entire project again. Every connected chat checks your project before it answers, so you never re-explain it.](https://truthspine.app/media/listing/truthspine-panel-1.png)

![My agents drift onto old plans or the wrong project. Each chat works with its own project, and the current decisions win over old ones.](https://truthspine.app/media/listing/truthspine-panel-2.png)

![Built to work where You work. 19 AI apps on Windows, 18 on Mac and Linux, and cloud agents through Remote access.](https://truthspine.app/media/listing/truthspine-panel-6.png)

## Setup

1. Install and open the TruthSpine app, and connect your project folder in it.
2. Add an MCP server to your tool that runs `npx -y @timeprooflabs/truthspine-mcp --host <tool>`, started in your project folder (or add `--project <folder>`). Use your tool's name for `<tool>`. Without `--host` the connection is labelled as an agent on this computer.
3. In a chat, say "Connect TruthSpine".

Names for `--host`:

- Claude Desktop: `claude-desktop`
- Claude Code: `claude-code`
- Codex: `codex-cli`
- Cursor: `cursor`
- VS Code: `vscode`
- GitHub Copilot in VS Code: `github-copilot-vscode`
- Cline: `cline`
- Windsurf / Devin: `windsurf-devin`
- OpenCode: `opencode`
- LM Studio: `lm-studio`
- Kiro: `kiro`
- Google Antigravity: `antigravity`
- JetBrains IDEs: `jetbrains`
- Zed: `zed`
- Hermes Agent: `hermes-agent`
- OpenClaw: `openclaw`
- GitHub Copilot CLI: `copilot-cli`
- Droid: `droid`
- Pi: `pi`
- Gemini CLI: `gemini-cli`

The TruthSpine app can also write these settings for you: open Connections and choose your tool.

## Tools

- `attach`: Attach this chat to the project's TruthSpine record and receive the current brief: decisions, completed work, evidence and next steps.
- `consult`: Ask what is true about the project, what was decided and why, or what to do next. Read only.
- `record`: Save a decision, finished work, a failure or the next step to the project's record on this computer.
- `history`: Read what was saved recently, or confirm that a save was recorded. Read only.

## Licence

This connector is open source (Apache License 2.0). It needs the TruthSpine app, which you get separately.
The connector needs no license of its own.
On Windows, get the TruthSpine app from the Microsoft Store.
On Mac, get the TruthSpine app from the App Store.
On Linux, get the TruthSpine AppImage from truthspine.app.

## Privacy Policy

Full policy: https://truthspine.app/privacy

- **What is collected:** this connector collects nothing itself. It starts the TruthSpine app installed on your computer and passes your agent's requests to it.
- **Use and storage:** the TruthSpine app keeps your project record (decisions, completed work, evidence references and next steps) in its data folder on your computer. Project files are read on your computer and are not uploaded by TruthSpine.
- **Third-party sharing:** none by this connector. What your agent shows or sends to its own AI provider is governed by that provider. The app contacts TimeProofLabs only for licence checks and, if you agree to it, anonymous usage counts. Purchases go through Microsoft, Apple or Stripe. Optional features you turn on, such as remote access or GitHub projects, connect only to accounts you choose.
- **Retention:** the record stays on your computer until you delete the project or the app's data; you can download or delete it at any time from the app.
- **Contact:** support@truthspine.app

Support: https://truthspine.app/support
