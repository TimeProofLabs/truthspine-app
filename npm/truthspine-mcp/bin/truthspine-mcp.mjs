#!/usr/bin/env node
import os from "node:os";
import launcher from "../lib/installed-mcp-launcher.cjs";
import contract from "../lib/claude-lifecycle-contract.cjs";

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 && typeof args[index + 1] === "string" ? args[index + 1] : null; };
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write("truthspine-mcp [--host <tool>] [--project <folder>]\nStarts the TruthSpine connector for the TruthSpine app installed on this computer.\n");
  process.exit(0);
}
const configuredRoot = String(option("--project") ?? process.env.TRUTHSPINE_PROJECT_ROOT ?? "").trim();
const host = String(option("--host") ?? process.env.TRUTHSPINE_HOST_ID ?? "computer-agent").trim().toLowerCase();
const controller = new AbortController();
let connection;
let startupStage = "workspace-binding";
const stop = () => { controller.abort(); connection?.stop(1); };
process.once("SIGINT", stop); process.once("SIGTERM", stop);
try {
  const unresolved = /\$\{[^}]+\}|%[A-Za-z_][A-Za-z0-9_]*%|\$env:[A-Za-z_][A-Za-z0-9_]*/i.test(configuredRoot);
  process.env.TRUTHSPINE_PROJECT_ROOT = launcher.resolveBoundedHostWorkspace({ cwd: unresolved ? process.cwd() : configuredRoot || process.cwd(), homeDir: os.homedir() }).projectRoot;
  process.env.TRUTHSPINE_LOCK_PROJECT_ROOT = "1";
  process.env.TRUTHSPINE_HOST_ID = host;
  process.env.TRUTHSPINE_LAUNCHER_HOST_ID = host;
  delete process.env.NODE_OPTIONS; delete process.env.NODE_PATH;
  startupStage = "installed-runtime-start";
  process.env.TRUTHSPINE_RUNTIME_REGISTRATION_PATH = contract.defaultRuntimeRegistrationPath();
  connection = await launcher.startInstalledMcpLauncherWithRecovery({ signal: controller.signal });
  const result = await connection.closed;
  process.exitCode = result.code;
} catch {
  const guidance = startupStage === "workspace-binding"
    ? "Start it inside your project folder or pass --project <folder>. Licensing has not been checked; do not sign in or purchase to resolve this."
    : "Install and open the TruthSpine app, connect this project in it, and check --host names your tool. This startup error alone does not establish a licensing failure.";
  process.stderr.write(`TruthSpine startup failed at ${startupStage}. ${guidance}\n`);
  process.exitCode = 1;
} finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
