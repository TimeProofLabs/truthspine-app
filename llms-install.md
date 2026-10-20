# Installing TruthSpine (instructions for AI agents)

TruthSpine's MCP server is part of the TruthSpine desktop app; there is nothing to download from this repository for your own MCP settings.

1. Ask the user whether the TruthSpine app is installed and their project is connected in it. If not, send them to https://truthspine.app/download and wait.
2. Preferably ask the user to open the TruthSpine app, choose Connections, and choose your tool (for example Cline); the app writes your MCP settings for the current project.
   If the user asks you to do it instead, add one MCP server named `truthspine`: command `npx`, arguments `-y @timeprooflabs/truthspine-mcp --host <your tool, for example cline> --project <the open project folder>`. Do not add any other TruthSpine entry.
3. Reload your MCP servers, confirm a server named `truthspine` is connected, then call `truthspine_attach` (the user's phrase for this is "Attach TruthSpine").
4. Never put passwords, keys or tokens into TruthSpine.
