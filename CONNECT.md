# Connect TruthSpine to your AI tools

TruthSpine is a desktop app that keeps your project's decisions, finished work, evidence and next steps, and gives them to the AI tools you connect. Each tool below needs the app installed and your project folder connected in it: Microsoft Store on Windows, Mac App Store on macOS, or the AppImage from truthspine.app on Linux. Then say "Connect TruthSpine" in a chat.

| Tool | How to connect |
| --- | --- |
| Claude Code, Claude Desktop, Claude chat and Cowork | Add the TruthSpine plugin from the Claude directory, or in Claude Code: `/plugin marketplace add TimeProofLabs/truthspine-app` then `/plugin install truthspine@timeprooflabs`. |
| Cursor | Add TruthSpine from the Cursor Marketplace. |
| Gemini CLI | `gemini extensions install https://github.com/TimeProofLabs/truthspine-app` |
| VS Code, VSCodium, Windsurf and other Open VSX editors | Install "TruthSpine - Project Memory for AI Coding Agents" from the Visual Studio Marketplace or Open VSX. |
| JetBrains IDEs | Install "TruthSpine - Project Memory for AI Coding Agents" from JetBrains Marketplace. |
| Any app that installs MCP bundles | Download `truthspine-0.2.1.mcpb` from this repository's releases. In Claude Desktop, open Settings, then Extensions, and drag the file onto "Drag .MCPB or .DXT files here to install". Then say "Connect TruthSpine" in a chat. |
| Cline, Zed, Kiro, LM Studio, OpenCode, Codex and others | In the TruthSpine app, open Connections and choose the tool; the app writes that tool's settings for the project. |
| Any other MCP tool | Add a server that runs `npx -y @timeprooflabs/truthspine-mcp --host <tool>` in your project folder (or add `--project <folder>`). |

TruthSpine runs on your computer. The connector never uploads your project; see the privacy policy: https://truthspine.app/privacy
