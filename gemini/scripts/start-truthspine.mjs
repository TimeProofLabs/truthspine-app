import os from "node:os";
import launcher from "./installed-mcp-launcher.cjs";
import contract from "./claude-lifecycle-contract.cjs";

const configuredRoot = String(process.env.TRUTHSPINE_PROJECT_ROOT || "").trim();
const controller = new AbortController();
let connection;
let startupStage = "workspace-binding";
const stop = () => { controller.abort(); connection?.stop(1); };
process.once("SIGINT", stop); process.once("SIGTERM", stop);
try {
  const unresolved = /\$\{[^}]+\}|%[A-Za-z_][A-Za-z0-9_]*%|\$env:[A-Za-z_][A-Za-z0-9_]*/i.test(configuredRoot);
  try {
    process.env.TRUTHSPINE_PROJECT_ROOT = launcher.resolveBoundedHostWorkspace({ cwd: unresolved ? process.cwd() : configuredRoot || process.cwd(), homeDir: os.homedir() }).projectRoot;
  } catch { process.env.TRUTHSPINE_FIND_PROJECT = "1"; }
  if (process.env.TRUTHSPINE_FIND_PROJECT === "1") { delete process.env.TRUTHSPINE_PROJECT_ROOT; delete process.env.TRUTHSPINE_LOCK_PROJECT_ROOT; }
  process.env.TRUTHSPINE_LAUNCHER_HOST_ID = "gemini-cli";
  startupStage = "installed-runtime-start";
  // A public package carries no machine-specific path: use where the installed app records itself.
  process.env.TRUTHSPINE_RUNTIME_REGISTRATION_PATH = contract.defaultRuntimeRegistrationPath();
  connection = await launcher.startInstalledMcpLauncherWithRecovery({ signal: controller.signal });
  const result = await connection.closed;
  process.exitCode = result.code;
} catch {
  const guidance = startupStage === "workspace-binding"
    ? "The host did not provide a usable bounded project directory. Open the intended project and reconnect its workspace-scoped TruthSpine connector. Licensing has not been checked; do not sign in or purchase to resolve this workspace error."
    : "Open the installed TruthSpine app and reconnect the project. This startup error alone does not establish a licensing failure.";
  process.stderr.write(`TruthSpine startup failed at ${startupStage}. ${guidance} No checkout fallback is allowed.\n`);
  process.exitCode = 1;
} finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
