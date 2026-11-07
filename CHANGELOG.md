# Changelog

## Connectors 0.2.2 (2026-11-07)

- The connectors describe TruthSpine in the new wording, and they use the short tool names the app gives: `attach`, `consult`, `record` and `history`.
- The MCP bundle `truthspine-0.2.2.mcpb` is on the [v0.2.2 release](https://github.com/TimeProofLabs/truthspine-app/releases/tag/v0.2.2), and `@timeprooflabs/truthspine-mcp` and `truthspine` 0.2.2 are on npm.

## TruthSpine 0.1.38 (Linux), 2026-11-07

Connect now carries on where you left off. If a connection is waiting for your approval, TruthSpine still shows it after you close and reopen the app, and Connect continues with your project instead of asking you to add it again. If you have no project yet, Connect asks you to add one first.

TruthSpine now finds AI apps you install while it is running, and the new "Look for AI apps again" button checks right away.

Your decision logs and plans are read the way people write them. Dated decisions count, and the first step of a plan shows as your next step. When two chats disagree, TruthSpine shows both sides, with who said each and when. When you rule on a line in a file, your ruling comes first wherever that line still appears. Old and retired folders count as history and stay out of answers.

When a chat finishes a step, TruthSpine says which step it closed and what comes next. Each chat's own words are kept.

TruthSpine now reads only the files that changed, so it does less work in the background.

Claude Code, Codex, LM Studio and other local models connect more simply. A chat that was set up before TruthSpine was installed tells you to get or open TruthSpine, then connects by itself.

With Remote access, you choose which projects each connection can reach.

Project pages no longer flash back to loading, and the first page no longer waits for the trial check.

## Connectors 0.2.0 (2026-10-20)

- TruthSpine plugins for Claude Code, Cursor and Gemini CLI, installable from this repository.
- The MCP bundle `truthspine-0.2.0.mcpb` on the [v0.2.0 release](https://github.com/TimeProofLabs/truthspine-app/releases/tag/v0.2.0), and `@timeprooflabs/truthspine-mcp` on npm.
- Every tool and how to connect it: [CONNECT.md](CONNECT.md).

## TruthSpine 0.1.104 (Windows), 0.1.7 (Mac and Linux), 2026-10-20

- Linux: the AppImage is on the [releases](https://github.com/TimeProofLabs/truthspine-app/releases) page.
- Full release notes are in the Microsoft Store and the Mac App Store.

## 0.1.0

- Initial TruthSpine V1 public release.
- Local project Truth for supported AI chats, IDEs, and agent workspaces.
- Project-scoped decisions, sources, history, next work, and SHA-256 lineage.
- Guided source and workspace connection flow.
