import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import launcher from "./installed-mcp-launcher.cjs";
import contract from "./claude-lifecycle-contract.cjs";
import { executeInstalledMcpCommand } from "./installed-mcp-command.mjs";

const plans = new WeakMap();
const MESSAGE = "TruthSpine automatic attachment was not confirmed. Open the installed app and reconnect this workspace. Do not purchase again or assume a failed attachment made no changes.";
const fail = () => { throw new Error(MESSAGE); };
// Why the hook failed, after its sentence (0b (1), Brain 2026-11-01: the Code tab's hook said only MESSAGE, so its cause
// could not be named): the error's code, its words when they are not one of the customer sentences, and where it stopped
// (functions and lines, never a path). The same as the launchers' STARTUP_CAUSE_LINES (surface-connector-runtime.js);
// written out here, since this file ships alone in the plugin.
export function failureCause(error) {
  const said = (value, most) => String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/(?:[A-Za-z]:)?[\\/][^\s'"`]+/g, "[path]").trim().slice(0, most);
  const where = String(error?.stack ?? "").split("\n").slice(1).map(frame => /at (?:async )?([\w.$<>]+) \(.*?([\w.-]+):(\d+):\d+\)$/.exec(frame.trim()))
    .filter(Boolean).slice(0, 3).map(([, name, file, line]) => `${name} ${file}:${line}`).join(" < ");
  const words = /purchase is not affected|do not purchase again/i.test(String(error?.message ?? "")) ? "" : said(error?.message ?? error, 400);
  return [said(error?.code, 80), words, where && `at ${where}`].filter(Boolean).join(": ");
}

export function buildClaudeLifecyclePlan(input, { registrationPath, homeDir = os.homedir(),
  platform = process.platform, env = process.env } = {}) {
  if (typeof registrationPath !== "string" || !path.isAbsolute(registrationPath)) fail();
  const request = contract.buildClaudeSessionStartRequest(input, { homeDir, platform });
  const registration = launcher.readRegistration(registrationPath);
  const physicalRoot = fs.realpathSync(request.projectRoot), initial = fs.statSync(physicalRoot, { bigint: true });
  const serialized = JSON.stringify(registration);
  const assertPolicy = () => {
    const current = fs.statSync(request.projectRoot, { bigint: true });
    if (fs.realpathSync(request.projectRoot) !== physicalRoot || !current.isDirectory()
      || current.dev !== initial.dev || current.ino !== initial.ino
      || JSON.stringify(launcher.readRegistration(registrationPath)) !== serialized) fail();
  };
  const transportOptions = { registration, registrationPath, projectRoot: request.projectRoot,
    platform, env: { ...env }, hostId: "claude-code" };
  const transport = launcher.buildInstalledMcpLaunchPlan(transportOptions);
  const plan = Object.freeze({ request, transport });
  plans.set(plan, { assertPolicy });
  return plan;
}

export async function executeClaudeLifecyclePlan(plan, { signal,
  executeImpl = executeInstalledMcpCommand } = {}) {
  const privatePlan = plans.get(plan);
  if (!privatePlan || signal?.aborted) fail();
  privatePlan.assertPolicy();
  // One installed-core call. An uncertain onboarding outcome is never retried.
  const result = await executeImpl({ transport: plan.transport,
    request: { command: "onboard", tool: plan.request.tool, arguments: plan.request.arguments },
    assertPolicy: privatePlan.assertPolicy, clientName: "truthspine-claude-lifecycle" },
    { signal, deadlineMs: 30000, shutdownMs: 3000 });
  privatePlan.assertPolicy();
  if (signal?.aborted || result?.code !== 0 || result.cleanupConfirmed !== true
    || typeof result.stdout !== "string" || Buffer.byteLength(result.stdout) > 2 * 1024 * 1024) fail();
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { fail(); }
  if (envelope.schema !== "truthspine.installed-command-result.v1"
    || envelope.command !== "onboard" || envelope.tool !== plan.request.tool) fail();
  return contract.formatClaudeSessionStartResult(plan.request, envelope.result);
}

export function readClaudeLifecycleInput(input, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    let chunks = [], bytes = 0;
    const cleanup = () => { clearTimeout(timer); input.removeListener("data", data); input.removeListener("end", end); input.removeListener("error", error); };
    const error = () => { cleanup(); input.pause(); reject(new Error(MESSAGE)); };
    const data = chunk => { const buffer = Buffer.from(chunk); bytes += buffer.length;
      if (bytes > 65536) return error(); chunks.push(buffer); };
    const end = () => { cleanup(); const buffer = Buffer.concat(chunks), text = buffer.toString("utf8");
      if (!Buffer.from(text).equals(buffer)) reject(new Error(MESSAGE)); else resolve(text); chunks = []; };
    const timer = setTimeout(error, timeoutMs);
    input.on("data", data); input.once("end", end); input.once("error", error);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController(), stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    // The public plugin passes no path and uses the app's own default location.
    if (process.argv.length !== 2 && process.argv.length !== 3) fail();
    const registrationPath = process.argv.length === 3 ? process.argv[2] : contract.defaultRuntimeRegistrationPath();
    const input = await readClaudeLifecycleInput(process.stdin);
    if (controller.signal.aborted) fail();
    const plan = buildClaudeLifecyclePlan(input, { registrationPath });
    const result = await executeClaudeLifecyclePlan(plan, { signal: controller.signal });
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) { const cause = failureCause(error); process.stderr.write(`${MESSAGE}${cause ? ` Cause: ${cause}` : ""}\n`); process.exitCode = 1; }
  finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
