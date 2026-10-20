// Shared engine-free installed MCP command exchange. Host adapters retain
// their own policy checks; native entitlement and workspace access stay in core.
import { PassThrough, Writable } from "node:stream";
import installedLauncher from "./installed-mcp-launcher.cjs";
const MESSAGE = "TruthSpine could not complete this installed-app connection. Its workspace, permissions, or runtime need reconnection. Do not purchase again solely because verification failed; do not retry a write until its outcome is checked.";
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
function fail(code = "connection-held") { const error = new Error(MESSAGE); error.code = code; throw error; }

function validateToolRequest(schema, args) {
  // Reject ignored nested selectors/event fields too. This bounded subset
  // checks the installed catalog's structural contract, not semantic admission,
  // entitlement, user authorization, or whether an observation is true.
  if (!object(schema) || schema.type !== "object" || !object(schema.properties)) fail("tool-contract-held");
  let visited = 0;
  const validate = (rule, value, depth) => {
    if (++visited > 4096 || depth > 32 || !object(rule)
      || ["$ref", "anyOf", "oneOf", "allOf", "not", "if"].some(key => Object.hasOwn(rule, key))) fail("tool-contract-held");
    if (rule.enum !== undefined && (!Array.isArray(rule.enum) || !rule.enum.includes(value))) fail("tool-contract-held");
    if (rule.type !== undefined) {
      const matches = rule.type === "object" ? object(value) : rule.type === "array" ? Array.isArray(value)
        : rule.type === "integer" ? Number.isSafeInteger(value) : rule.type === "number" ? typeof value === "number" && Number.isFinite(value)
          : rule.type === "null" ? value === null : ["string", "boolean"].includes(rule.type) && typeof value === rule.type;
      if (!matches) fail("tool-contract-held");
    }
    if (typeof value === "string") {
      if ((rule.minLength !== undefined && value.length < rule.minLength) || (rule.maxLength !== undefined && value.length > rule.maxLength)) fail("tool-contract-held");
      if (rule.pattern !== undefined) {
        if (typeof rule.pattern !== "string" || rule.pattern.length > 1024) fail("tool-contract-held");
        try { if (!new RegExp(rule.pattern).test(value)) fail("tool-contract-held"); } catch { fail("tool-contract-held"); }
      }
    }
    if (typeof value === "number" && ((rule.minimum !== undefined && value < rule.minimum) || (rule.maximum !== undefined && value > rule.maximum))) fail("tool-contract-held");
    if (object(value)) {
      if (rule.required !== undefined && (!Array.isArray(rule.required) || rule.required.some(key => typeof key !== "string" || !Object.hasOwn(value, key)))) fail("tool-contract-held");
      if (rule.properties !== undefined && !object(rule.properties)) fail("tool-contract-held");
      for (const [key, child] of Object.entries(value)) {
        if (Object.hasOwn(rule.properties ?? {}, key)) validate(rule.properties[key], child, depth + 1);
        else if (rule.additionalProperties === false || depth === 0) fail("tool-contract-held");
        else if (object(rule.additionalProperties)) validate(rule.additionalProperties, child, depth + 1);
      }
    }
    if (Array.isArray(value)) {
      if ((rule.minItems !== undefined && value.length < rule.minItems) || (rule.maxItems !== undefined && value.length > rule.maxItems)) fail("tool-contract-held");
      if (rule.items !== undefined) for (const item of value) validate(rule.items, item, depth + 1);
    }
  };
  validate(schema, args, 0);
}

export async function executeInstalledMcpCommand({ transport, request, assertPolicy,
  clientName = "truthspine-installed-command", resultSchema = "truthspine.installed-command-result.v1" }, {
  relayImpl = installedLauncher.relayInstalledMcp, validateImpl = installedLauncher.validateInstalledLaunchPlan,
  deadlineMs = 60000, shutdownMs = 3000, maxOutputBytes = 2 * 1024 * 1024, signal
} = {}) {
  if (typeof assertPolicy !== "function" || !object(request) || typeof request.tool !== "string"
    || !Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > 120000
    || !Number.isInteger(shutdownMs) || shutdownMs < 1 || shutdownMs > 5000
    || !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1024 || maxOutputBytes > 4 * 1024 * 1024) fail("invalid-execution");
  assertPolicy();
  validateImpl(transport);
  if (signal?.aborted) fail("interrupted");
  const input = new PassThrough(); let buffer = Buffer.alloc(0), total = 0, pending, sequence = 0, connection;
  let failure, deadline, cleanupDeadline, successfulResult, operationFinished = false;
  const framing = transport.mode === "app-owned-socket" ? "content-length" : "jsonl";
  const reject = code => { failure ||= code; if (pending) { const current = pending; pending = null; current.reject(new Error(MESSAGE)); } };
  const receive = message => {
    if (!object(message) || message.jsonrpc !== "2.0") return reject("invalid-protocol");
    if (!Object.hasOwn(message, "id")) return; // Bounded informational notifications.
    if (!pending || message.id !== pending.id) return reject("unexpected-response");
    const current = pending; pending = null;
    if (message.error || !Object.hasOwn(message, "result")) { failure ||= "tool-rejected"; current.reject(new Error(MESSAGE)); }
    else current.resolve(message.result);
  };
  const output = new Writable({ write(chunk, encoding, callback) {
    try {
      total += chunk.length; if (total > maxOutputBytes) fail("output-limit");
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length) {
        let body;
        if (framing === "jsonl") {
          const end = buffer.indexOf(10); if (end < 0) break;
          body = buffer.subarray(0, end); buffer = buffer.subarray(end + 1);
          if (!body.length) continue;
        } else {
          const end = buffer.indexOf("\r\n\r\n"); if (end < 0) { if (buffer.length > 1024) fail("invalid-protocol"); break; }
          const header = buffer.subarray(0, end).toString("ascii");
          const match = /^Content-Length: ([0-9]+)$/i.exec(header);
          if (!match) fail("invalid-protocol");
          const length = Number(match[1]);
          if (!Number.isSafeInteger(length) || length < 1 || length > maxOutputBytes) fail("output-limit");
          if (buffer.length < end + 4 + length) break;
          body = buffer.subarray(end + 4, end + 4 + length); buffer = buffer.subarray(end + 4 + length);
        }
        const text = body.toString("utf8"); if (!Buffer.from(text).equals(body)) fail("invalid-protocol");
        receive(JSON.parse(text));
      }
      callback();
    } catch (error) { reject(error.code || "invalid-protocol"); connection?.stop(1); callback(); }
  } });
  const send = message => {
    const bytes = Buffer.from(JSON.stringify(message));
    input.write(framing === "jsonl" ? Buffer.concat([bytes, Buffer.from("\n")])
      : Buffer.concat([Buffer.from(`Content-Length: ${bytes.length}\r\n\r\n`), bytes]));
  };
  const rpc = (method, params) => {
    if (failure) return Promise.reject(new Error(MESSAGE));
    return new Promise((resolve, rejectPromise) => { pending = { id: ++sequence, resolve, reject: rejectPromise }; send({ jsonrpc: "2.0", id: sequence, method, params }); });
  };
  const abort = () => { reject("interrupted"); connection?.stop(1); };
  try {
    if (signal?.aborted) fail("interrupted");
    signal?.addEventListener("abort", abort, { once: true });
    connection = relayImpl(transport, { input, output, shutdownMs });
    connection.closed.then(() => { if (!operationFinished) reject("transport-closed"); }, () => reject("transport-failed"));
    deadline = setTimeout(() => { reject("deadline"); connection.stop(1); }, deadlineMs);
    const initialized = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: clientName, version: "1" } });
    if (!object(initialized) || typeof initialized.protocolVersion !== "string") fail("invalid-initialize");
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const catalog = await rpc("tools/list", {});
    const matches = Array.isArray(catalog?.tools) ? catalog.tools.filter(tool => tool?.name === request.tool) : [];
    if (matches.length !== 1) fail("tool-unavailable");
    validateToolRequest(matches[0].inputSchema, request.arguments);
    assertPolicy();
    const result = await rpc("tools/call", { name: request.tool, arguments: request.arguments });
    if (!object(result) || result.isError === true || !Array.isArray(result.content)
      || result.content.length !== 1 || result.content[0]?.type !== "text" || typeof result.content[0].text !== "string") fail("tool-result-held");
    let value;
    try { value = JSON.parse(result.content[0].text); } catch { fail("tool-result-held"); }
    assertPolicy();
    successfulResult = { schema: resultSchema, command: request.command, tool: request.tool, result: value };
    operationFinished = true;
  } catch (error) { failure ||= error.code || "connection-held"; }
  finally {
    clearTimeout(deadline); signal?.removeEventListener("abort", abort);
    if (connection) {
      connection.stop(failure ? 1 : 0);
      let closed;
      try { closed = await Promise.race([connection.closed, new Promise(resolve => {
        cleanupDeadline = setTimeout(() => resolve({ code: 1, cleanupConfirmed: false }), shutdownMs * 4 + 250);
      })]); } catch { closed = { code: 1, cleanupConfirmed: false }; }
      clearTimeout(cleanupDeadline);
      input.destroy(); output.destroy();
      if (closed.cleanupConfirmed !== true || closed.code !== 0 || failure) return {
        status: "held", code: 1, reason: closed.cleanupConfirmed !== true ? "cleanup-unconfirmed" : failure || "transport-failed",
        cleanupConfirmed: closed.cleanupConfirmed === true, pid: connection.pid ?? null, stdout: ""
      };
      return { status: "response-received", code: 0, cleanupConfirmed: true, pid: connection.pid ?? null,
        stdout: JSON.stringify(successfulResult) + "\n" };
    }
    input.destroy(); output.destroy();
  }
  return { status: "held", code: 1, reason: failure || "connection-held", cleanupConfirmed: true, pid: null, stdout: "" };
}
