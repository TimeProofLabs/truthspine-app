# Installing TruthSpine (instructions for AI agents)

TruthSpine's MCP server is part of the TruthSpine desktop app; there is nothing to download from this repository for your own MCP settings.

1. Ask the user whether the TruthSpine app is installed and their project is connected in it. If not, send them to https://truthspine.app/download and wait.
2. Preferably ask the user to open the TruthSpine app, choose Connections, and choose your tool; the app writes your MCP settings for the current project.
   For Cline, and whenever the user asks you to do it instead, add one MCP server named `truthspine`: command `npx`, arguments `-y @timeprooflabs/truthspine-mcp --host <your tool, for example cline> --project <the open project folder>`. Do not add any other TruthSpine entry.
   - Cline keeps its MCP servers in `cline_mcp_settings.json` (in Cline: MCP Servers, then Configure MCP Servers or Edit Configuration opens it). Cline 4, in the editor and on the command line, uses:
     - macOS and Linux: `~/.cline/data/settings/cline_mcp_settings.json`
     - Windows: `%USERPROFILE%\.cline\data\settings\cline_mcp_settings.json`

     If `CLINE_DATA_DIR` is set, the file is in its `settings` folder instead. Older Cline versions keep it in VS Code's global storage, under `globalStorage/saoudrizwan.claude-dev/settings/`.

     Add this entry under `mcpServers`, with the real project folder. If a `truthspine` entry is already there, replace it with this one:

     ```json
     "truthspine": {
       "command": "npx",
       "args": ["-y", "@timeprooflabs/truthspine-mcp", "--host", "cline", "--project", "<the open project folder>"]
     }
     ```

     On Windows, if `npx` does not start, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "@timeprooflabs/truthspine-mcp", "--host", "cline", "--project", "<the open project folder>"]`.
3. Reload your MCP servers, confirm a server named `truthspine` is connected, then call `truthspine_attach` (the user's phrase for this is "Attach TruthSpine").
4. Never put passwords, keys or tokens into TruthSpine.
