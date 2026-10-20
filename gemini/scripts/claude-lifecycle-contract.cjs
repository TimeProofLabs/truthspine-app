"use strict";
const crypto = require("node:crypto");
const launcher = require("./installed-mcp-launcher.cjs");

const fail = () => { throw new Error("TruthSpine could not bind this Claude session to its workspace. No automatic attachment was confirmed."); };
// Only the host lifecycle envelope is consumed. transcript_path is never read;
// permission_mode is never treated as a TruthSpine permission grant.
function buildClaudeSessionStartRequest(input, { homeDir, platform = process.platform } = {}) {
  if (typeof input !== "string" || Buffer.byteLength(input) > 65536) fail();
  let event;
  try { event = JSON.parse(input); } catch { fail(); }
  if (!event || typeof event !== "object" || Array.isArray(event)
    || event.hook_event_name !== "SessionStart"
    || !["startup", "resume", "clear", "compact"].includes(event.source)
    || typeof event.session_id !== "string" || !event.session_id.trim()
    || event.session_id.length > 2048 || /[\u0000-\u001f\u007f]/.test(event.session_id)) fail();
  const { projectRoot } = launcher.resolveBoundedHostWorkspace({ cwd: event.cwd, homeDir, platform });
  return Object.freeze({
    tool: "truthspine_onboard_chat",
    // Host/workspace are fixed by the transport, not overridable tool selectors.
    // Older catalogs reject identityMode before tools/call, preventing silent
    // fallback to the old per-attachment/title-derived chat identity.
    arguments: Object.freeze({ hostChatId: event.session_id, identityMode: "host-thread" }),
    projectRoot,
    sessionIdHash: crypto.createHash("sha256").update(event.session_id).digest("hex")
  });
}

function formatClaudeSessionStartResult(request, result) {
  const metrics = result?.metrics;
  if (!request || request.tool !== "truthspine_onboard_chat"
    || result?.project?.projectRoot !== request.projectRoot
    || result?.binding?.hostSurface !== "claude-code"
    || result?.binding?.hostChatIdHash !== request.sessionIdHash
    || metrics?.hostSurface !== "claude-code"
    || typeof metrics?.label !== "string" || !/^[a-z0-9][a-z0-9_-]{0,255}$/.test(metrics.label)
    || metrics.runId !== metrics.label || metrics.sourceRef !== metrics.label
    || !/^[a-f0-9]{32}$/.test(metrics.chatSessionFingerprint || "")) fail();
  const readScope = { chatId: metrics.label, chatSessionFingerprint: metrics.chatSessionFingerprint };
  const syncIdentity = { runId: metrics.label, sourceRef: metrics.label,
    chatSessionFingerprint: metrics.chatSessionFingerprint };
  return {
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: [
      "TruthSpine has returned this session's workspace-bound attachment identity.",
      `Use this readScope for project-dependent TruthSpine reads: ${JSON.stringify(readScope)}.`,
      `Use this identity for governed session updates: ${JSON.stringify(syncIdentity)}.`,
      `For an explicit Attach TruthSpine request in this same host session/workspace, call truthspine_onboard_chat with these exact arguments: ${JSON.stringify(request.arguments)}. Never replace them with an empty object or a guessed title/ID.`,
      "Consult truthspine_answer_guard before project-dependent answers and actions. Persist meaningful work deltas through governed session updates using this same identity; do not copy another chat's identity.",
      "These identifiers provide attribution, not owner authorization or proof that reported work is correct."
    ].join("\n") }
  };
}
// Where the installed app records itself (the same place the app writes it). Used when a
// public connector carries no machine-specific path; an explicit setting still wins.
function defaultRuntimeRegistrationPath({ platform = process.platform, env = process.env,
  homeDir = require("node:os").homedir() } = {}) {
  const path = require("node:path");
  const configured = String(env.TRUTHSPINE_RUNTIME_REGISTRATION_PATH || "").trim();
  if (configured) return configured;
  // Windows: ~\.truthspine\app, never AppData, which a Store app sees only in its private copy (shared-registration-path.js).
  if (platform === "win32") return path.win32.join(homeDir, ".truthspine", "app", "runtime.json");
  const home = homeDir.replace(/\\/g, "/");
  if (platform === "darwin") return path.posix.join(home, "Library", "Application Support", "TruthSpine", "runtime.json");
  return path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, ".config"), "TruthSpine", "runtime.json");
}

module.exports = { buildClaudeSessionStartRequest, formatClaudeSessionStartResult, defaultRuntimeRegistrationPath };
