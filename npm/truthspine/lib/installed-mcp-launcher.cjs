#!/usr/bin/env node
"use strict";

// Thin connector transport, compatible with the MCPB's Node >=16 runtime.
// No TruthSpine engine import. Registration selects a launch destination; it
// never supplies Store ownership. The installed core verifies native access.
// (The one exception runs the installed package's own server in this process: inPlaceHandover below.)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const net = require("node:net");

const ERROR = "TruthSpine could not start. Open the TruthSpine app and try again. Your purchase is not affected.";
const fail = () => { throw new Error(ERROR); };
// Typed launcher results. Every failure still throws the same generic sentence (ERROR) and
// nothing below changes which conditions fail; a failure that can be told apart safely also
// carries a stable code so the entry point and host wrappers can show a short, honest message.
// The catalogue mirrors src/agent-contract/launcher-results.js and is kept inline because
// generated wrappers (MCPB, VS Code, Codex) must stay single-file with no engine import.
// license_required and incompatible_version are decided by the installed core after the
// connection opens, never by this transport.
const LAUNCHER_RESULTS = Object.freeze({
  app_not_installed: "TruthSpine isn't installed on this computer.",
  app_not_running: "TruthSpine is installed but not running. Open it and try again.",
  app_not_answering: "TruthSpine is installed but did not answer. Open the TruthSpine app and try again.",
  app_not_opened: "TruthSpine is installed but has not been opened yet. Open TruthSpine once, then try again.",
  unavailable: ERROR
});
const LAUNCHER_STORE_LINKS = Object.freeze({ win32: "https://apps.microsoft.com/detail/9pbn25k75vdj", darwin: "https://apps.apple.com/us/app/truthspine/id6794478470?mt=12" });
const LAUNCHER_CODE_PREFIX = "truthspine.launcher.";
const typedFail = code => { const error = new Error(ERROR); error.code = LAUNCHER_CODE_PREFIX + code; throw error; };
const typedCode = error => {
  const code = error && typeof error.code === "string" && error.code.indexOf(LAUNCHER_CODE_PREFIX) === 0 ? error.code.slice(LAUNCHER_CODE_PREFIX.length) : null;
  if (code && Object.prototype.hasOwnProperty.call(LAUNCHER_RESULTS, code)) return code;
  return error && error.message === "store_package_recovery_unavailable" ? "app_not_installed" : null;
};
// The one line a person should read when the launcher cannot connect.
function describeLauncherFailure(error, platform) {
  const code = typedCode(error) || "unavailable";
  const where = platform || process.platform;
  const link = code === "app_not_installed" ? LAUNCHER_STORE_LINKS[where] : undefined;
  // (truthspine.app on every platform, and Linux its own page: B8)
  const get = code === "app_not_installed" ? " Get it here: " + (link ? link + " or " + DOWNLOAD_PAGE : LAUNCHER_GET_LINKS[where] || DOWNLOAD_PAGE) : "";
  return { code, message: LAUNCHER_RESULTS[code] + get, storeLink: link };
}
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
// "continue" stays accepted so an entry an earlier version wrote keeps starting; TruthSpine no longer offers or writes it
// (Continue retired by the owner, 2026-10-09).
const HOST_IDS = new Set(["claude-desktop", "claude-code", "codex-cli", "cursor", "vscode", "github-copilot-vscode", "continue", "cline", "cline-cli", "windsurf-devin", "opencode", "opencode-ide", "lm-studio", "kiro", "antigravity", "jetbrains", "zed", "hermes-agent", "openclaw", "copilot-cli", "droid", "pi", "computer-agent", "gemini-cli"]);
// The smaller tool set each app gets; every app not named here gets the full catalog. Nothing falls into a smaller set by
// default: Claude Code did, from the copilot fallback (2026-09-08) and its joining the host list (2026-09-24), and a
// shipped package refused its session_update (Brain 2026-10-29).
const HOST_TOOL_PROFILES = Object.freeze({
  "claude-desktop": "claude-desktop",
  "lm-studio": "lm-studio",
  opencode: "local-agent", "hermes-agent": "local-agent", openclaw: "local-agent", droid: "local-agent", pi: "local-agent",
  vscode: "copilot", // VS Code's own sync command carries its session updates, not this connection
  "github-copilot-vscode": "copilot", // the same VS Code extension and sync command
  "copilot-cli": "copilot" // named so since July (surface-connector-runtime.js)
});
function absolute(value, paths) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value) || !paths.isAbsolute(value)) fail();
  return paths.resolve(value);
}
function equal(a, b, platform) { return platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b; }
// Program Files, where the Store installs (WindowsApps). Codex starts its servers with a short environment that leaves
// ProgramFiles out (Main Build, Windows VM 2026-10-10: TruthSpine stopped before Codex saw its tools); Windows keeps
// it on the system drive, as systemOrProgramFolder below already assumes. The executable must still sit exactly there.
function windowsProgramFiles(env, paths) {
  const named = env.ProgramFiles || env.PROGRAMFILES || env.ProgramW6432;
  if (named) return absolute(named, paths);
  const system = env.SystemRoot || env.SYSTEMROOT || env.windir || env.WINDIR;
  const drive = typeof system === "string" && paths.isAbsolute(system) ? paths.parse(paths.resolve(system)).root
    : typeof env.SystemDrive === "string" && /^[A-Za-z]:$/.test(env.SystemDrive) ? `${env.SystemDrive}\\` : null;
  if (!drive) fail();
  return paths.join(drive, "Program Files");
}
// An app started outside any project works in a system or program folder: JetBrains AI Assistant starts its servers in
// C:\Windows\system32 (Main Build, 2026-10-09), an app may start in its own install folder. Such a folder is never a
// project; the connection finds its project instead (launcherProjectRoot returns null).
function systemOrProgramFolder(root, platform, env) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const inside = base => {
    if (typeof base !== "string" || !base || !paths.isAbsolute(base)) return false;
    const resolved = paths.resolve(base);
    return equal(root, resolved, platform) || (platform === "win32" ? root.toLowerCase().indexOf(resolved.toLowerCase().replace(/\\$/, "") + "\\") === 0
      : root.indexOf(resolved.replace(/\/$/, "") + "/") === 0);
  };
  if (platform === "win32") {
    const drive = paths.parse(root).root;
    const local = env.LOCALAPPDATA;
    return [env.SystemRoot || env.SYSTEMROOT || env.windir || drive + "Windows", env.ProgramFiles || drive + "Program Files",
      env["ProgramFiles(x86)"] || drive + "Program Files (x86)", env.ProgramW6432, env.ProgramData || drive + "ProgramData",
      local && paths.join(local, "Programs"), local && paths.join(local, "Microsoft", "WindowsApps")].some(inside);
  }
  // /private/var is left out: a Mac's temporary folders live under it.
  return ["/usr", "/bin", "/sbin", "/lib", "/lib32", "/lib64", "/etc", "/opt", "/snap", "/proc", "/sys", "/dev", "/boot", "/var/lib",
    "/System", "/Library", "/Applications", "/private/etc"].some(inside) || /^\/tmp\/\.mount_[^/]+(\/|$)/.test(root);
}
// An AI app's own folder is never the person's project either: OpenClaw runs every agent turn in its own workspace
// (~/.openclaw/workspace, or agents.defaults.workspace in openclaw.json), whatever folder it was started from, and a chat
// there named that folder (Main Build, Linux 2026-10-10). The apps' settings and data folders in the home folder, and a
// configured OpenClaw workspace wherever it is, are refused; the connection then finds the person's project.
const APP_HOME_FOLDERS = [".openclaw", ".hermes", ".codex", ".claude", ".cursor", ".gemini", ".copilot", ".factory", ".pi", ".kiro",
  ".junie", ".ai", ".agents", ".truthspine", ".config", ".local", ".cache", ".vscode", ".vscode-insiders", ".vscode-oss", ".windsurf",
  ".codeium", ".continue", ".cline", ".lmstudio", ".ollama", ".opencode", ".zed", ".devin", ".npm", ".nvm", ".cargo", ".rustup",
  ".docker", ".ssh", ".gnupg"];
function insideFolder(root, base, platform) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (typeof base !== "string" || !base || !paths.isAbsolute(base)) return false;
  const resolved = paths.resolve(base);
  return equal(root, resolved, platform) || (platform === "win32" ? root.toLowerCase().indexOf(resolved.toLowerCase().replace(/\\$/, "") + "\\") === 0
    : root.indexOf(resolved.replace(/\/$/, "") + "/") === 0);
}
function openClawWorkspace(homeDir, platform) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  try {
    const file = paths.join(homeDir, ".openclaw", "openclaw.json");
    if (fs.statSync(file).size > 1024 * 1024) return null;
    const workspace = JSON.parse(fs.readFileSync(file, "utf8"))?.agents?.defaults?.workspace;
    if (typeof workspace !== "string" || !workspace.trim()) return null;
    const expanded = workspace.trim().replace(/^~(?=$|[\\/])/, homeDir);
    return paths.isAbsolute(expanded) ? expanded : null;
  } catch { return null; }
}
function appOwnFolder(root, homeDir, platform) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const home = paths.resolve(homeDir);
  const bases = APP_HOME_FOLDERS.map(name => paths.join(home, name));
  if (platform === "win32") bases.push(paths.join(home, "AppData", "Roaming"));
  if (platform === "darwin") bases.push(paths.join(home, "Library"));
  // The person's own program folder, where AppImages and unpacked apps live (Main Build, Linux 0.1.8: a chat started in
  // ~/Applications/VSCode-linux-x64 became a project and was learned at a third of a core), by its own path and by the
  // folder it links to (LinuxImac's ~/Applications points at /data/moved-from-home/Applications).
  if (platform !== "win32") {
    const programs = paths.join(home, "Applications");
    bases.push(programs);
    if (platform === process.platform) { try { bases.push(fs.realpathSync(programs)); } catch { /* none */ } }
  }
  bases.push(openClawWorkspace(home, platform));
  return bases.some(base => insideFolder(root, base, platform));
}
// Codex's dated scratch folders, one per day: Documents\Codex\<yyyy-mm-dd>\<name> (also under a OneDrive Documents).
// Not a new project: a chat working there never registers it (Brainstorming, 2026-10-21: the owner's
// Documents\Codex\2026-10-16\lo, copies of two public repositories a chat looked at, became "AI Dungeon Master"). Unlike
// the folders above, one registered earlier stays listed with its records, and asks for its real folder.
const CODEX_DAY_FOLDER = /^(?:onedrive[^\\/]*[\\/])?documents[\\/]codex(?:[\\/]\d{4}-\d{2}-\d{2}(?:[\\/].*)?)?$/i;
function scratchFolder(folder, { homeDir, platform = process.platform } = {}) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (typeof folder !== "string" || !paths.isAbsolute(folder) || typeof homeDir !== "string" || !paths.isAbsolute(homeDir)) return false;
  const root = longWindowsName(paths.resolve(folder), platform), home = paths.resolve(homeDir);
  if (!insideFolder(root, home, platform) || equal(root, home, platform)) return false;
  return CODEX_DAY_FOLDER.test(paths.relative(home, root));
}
// The account's own home folder, from the user database. In the Mac App Store sandbox HOME and os.homedir() are the
// app's container (~/Library/Containers/<app>/Data), so the person's real home and its Library would otherwise pass
// as projects; found on TestFlight build 45, 2026-10-10: every chat attached to TruthSpine's own container.
function accountHomeFolder() {
  try { const home = require("node:os").userInfo().homedir; return typeof home === "string" && home ? home : null; } catch { return null; }
}
// The system's temporary folder itself (not a folder inside it): a chat started there has no folder of its own (owner
// 2026-10-16, "yes to the tmp folder rule"; Main Build, Linux: a chat started in /tmp became a project named "tmp").
function systemTempFolder(root, platform, env) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const named = platform === "win32"
    ? [env.TEMP, env.TMP, env.LOCALAPPDATA && paths.join(env.LOCALAPPDATA, "Temp"), (env.SystemRoot || env.SYSTEMROOT || env.windir) && paths.join(env.SystemRoot || env.SYSTEMROOT || env.windir, "Temp")]
    : ["/tmp", "/var/tmp", "/private/tmp", "/private/var/tmp", env.TMPDIR];
  if (platform === process.platform) { try { named.push(require("node:os").tmpdir()); } catch { /* no temporary folder known */ } }
  return named.some(base => typeof base === "string" && paths.isAbsolute(base) && equal(root, paths.resolve(base), platform));
}
// TruthSpine's own throwaway folders (Brain 2026-10-28): a folder named truthspine-* in a temporary folder, and every
// folder inside one, is made by TruthSpine's tests and checks, never by the person; one test run on the owner PC
// (2026-09-27) left twenty such projects' data in the person's own TruthSpine home. A TruthSpine home that itself lives
// in a temporary folder (a test's or a check's own) keeps them as projects.
function temporaryFolders(platform, env) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const folders = platform === "win32" ? [env.TEMP, env.TMP, env.LOCALAPPDATA && paths.join(env.LOCALAPPDATA, "Temp")]
    : [env.TMPDIR, "/tmp", "/var/tmp", "/private/tmp", "/private/var/tmp", ...(platform === "darwin" ? ["/var/folders", "/private/var/folders"] : [])];
  if (platform === process.platform) {
    try { folders.push(require("node:os").tmpdir()); } catch { /* no temporary folder known */ }
    const account = platform === "win32" ? accountHomeFolder() : null;
    if (account) folders.push(paths.join(account, "AppData", "Local", "Temp"));
  }
  return folders.filter(folder => typeof folder === "string" && paths.isAbsolute(folder)).map(folder => paths.resolve(folder));
}
function throwawayFolder(root, homeDir, platform, env) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const temps = temporaryFolders(platform, env);
  let made = false;
  for (let folder = root; !made && paths.dirname(folder) !== folder; folder = paths.dirname(folder)) {
    made = /^truthspine-/i.test(paths.basename(folder)) && temps.some(temp => equal(paths.dirname(folder), temp, platform));
  }
  const truthHome = env.TRUTHSPINE_HOME || (typeof homeDir === "string" && paths.isAbsolute(homeDir) ? paths.join(homeDir, ".truthspine") : null);
  if (!made || typeof truthHome !== "string" || !paths.isAbsolute(truthHome)) return false;
  return !temps.some(temp => insideFolder(paths.resolve(truthHome), temp, platform));
}
// Judged by the path alone (a sandboxed relay may not look inside the folder): the disk root, a home folder (the one
// given and the account's own), a system or program folder, the temporary folder itself, TruthSpine's own throwaway
// folders, or an AI app's own folder is never a project.
function neverAProjectFolder(folder, { homeDir, platform = process.platform, env = process.env } = {}) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (typeof folder !== "string" || !paths.isAbsolute(folder)) return true;
  // (also for a saved project: the start-of-app tidy then removes a "MICROS~1" project an earlier version made)
  const root = longWindowsName(paths.resolve(folder), platform);
  if (equal(root, paths.parse(root).root, platform) || systemOrProgramFolder(root, platform, env || {})
    || systemTempFolder(root, platform, env || {}) || throwawayFolder(root, homeDir, platform, env || {})) return true;
  const homes = [homeDir, platform === process.platform ? accountHomeFolder() : null].filter(home => typeof home === "string" && paths.isAbsolute(home));
  return homes.some(home => equal(root, paths.resolve(home), platform) || appOwnFolder(root, home, platform));
}
// A Windows short name ("C:\PROGRA~1\MICROS~1") is the same folder as its long one ("C:\Program Files\Microsoft VS
// Code"), but it matches none of the folders above by name. Cline starts its servers in VS Code's install folder under
// its short name (Windows VM, 2026-10-20): it became a project named "MICROS~1". The name is read in full first.
function longWindowsName(root, platform) {
  if (platform !== "win32" || platform !== process.platform || !/~/.test(root)) return root;
  try { return fs.realpathSync.native(root); } catch { return root; }
}
function resolveBoundedHostWorkspace({ cwd, homeDir, platform = process.platform, env = process.env } = {}) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (typeof cwd !== "string" || !paths.isAbsolute(cwd)
    || typeof homeDir !== "string" || !paths.isAbsolute(homeDir)) throw new Error("TruthSpine needs an absolute host workspace directory.");
  const root = longWindowsName(paths.resolve(cwd), platform);
  if (neverAProjectFolder(root, { homeDir, platform, env })) {
    throw new Error("TruthSpine could not identify a bounded host workspace. Open the intended project or folder; the last app-selected project will not be used for this task.");
  }
  if (!fs.statSync(root).isDirectory()) throw new Error("TruthSpine's host workspace must be an existing directory.");
  const realRoot = fs.realpathSync(root), realHome = fs.realpathSync(homeDir);
  const account = platform === process.platform ? accountHomeFolder() : null;
  let realAccount = null;
  try { realAccount = account ? fs.realpathSync(account) : null; } catch { /* the account home may not be readable in a sandbox */ }
  if (equal(realRoot, realHome, platform) || neverAProjectFolder(realRoot, { homeDir: realHome, platform, env })
    || (realAccount && (equal(realRoot, realAccount, platform) || appOwnFolder(realRoot, realAccount, platform)))) {
    throw new Error("TruthSpine refused a workspace alias to an unbounded home or filesystem root.");
  }
  // Preserve lexical nested-folder/worktree selection; it is not the Git root
  // or the app's last selected project. Native access remains a core decision. VS Code starts servers in "c:\..."
  // (2026-10-09 probe): the drive letter is written one way so one folder is one project.
  return { projectRoot: platform === "win32" ? root.replace(/^[a-z]:/, drive => drive.toUpperCase()) : root };
}
function restrictiveTelemetryEnv(...sources) {
  return sources.some(env => {
    const mode = typeof env?.TRUTHSPINE_TELEMETRY_MODE === "string" ? env.TRUTHSPINE_TELEMETRY_MODE.trim().toLowerCase() : "";
    return mode && mode !== "production";
  }) ? { TRUTHSPINE_TELEMETRY_MODE: "disabled" } : {};
}

// Whether TruthSpine's own files are where its installer puts them (Brain 2026-11-01, B8): a copy installed but never opened
// has written no install record yet, and is told to open TruthSpine once rather than to get it. Names only, nothing run:
// the Store's command in WindowsApps, the app in Applications, the snap's or the system package's command.
function installedAppPresent({ platform = process.platform, env = process.env, homeDir = env.HOME || env.USERPROFILE || "",
  exists = file => fs.existsSync(file), names = folder => fs.readdirSync(folder) } = {}) {
  try {
    if (platform === "win32") {
      // (the execution alias is listed, never read: reading it may fail while starting it works)
      const folder = typeof env.LOCALAPPDATA === "string" && path.win32.isAbsolute(env.LOCALAPPDATA) ? path.win32.join(env.LOCALAPPDATA, "Microsoft", "WindowsApps") : null;
      return Boolean(folder) && names(folder).some(name => name.toLowerCase() === "truthspine-runtime.exe");
    }
    if (platform === "darwin") return ["/Applications/TruthSpine.app", homeDir ? path.posix.join(homeDir, "Applications", "TruthSpine.app") : null].some(file => file && exists(file));
    if (platform === "linux") return Object.values(LINUX_PACKAGE_COMMANDS).some(file => exists(file));
  } catch { /* not found */ }
  return false;
}

function readRegistration(filename) {
  let fd;
  try {
    // (no record at all: TruthSpine has never been installed and opened on this computer, B8; or installed, never opened)
    let before;
    try { before = fs.lstatSync(filename); }
    catch (error) { if (error && error.code === "ENOENT") typedFail(installedAppPresent() ? "app_not_opened" : "app_not_installed"); fail(); }
    if (!before.isFile() || before.isSymbolicLink() || before.size > 65536) fail();
    fd = fs.openSync(filename, "r");
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.size > 65536 || opened.ino !== before.ino || opened.dev !== before.dev) fail();
    const buffer = Buffer.alloc(65537); let used = 0;
    while (used < buffer.length) { const count = fs.readSync(fd, buffer, used, buffer.length - used, null); if (!count) break; used += count; }
    const after = fs.fstatSync(fd);
    if (used > 65536 || used !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) fail();
    const parsed = JSON.parse(buffer.subarray(0, used).toString("utf8"));
    if (!object(parsed) || parsed.schema !== "truthspine.installed-runtime.v1") fail();
    return parsed;
  } catch (error) { if (["app_not_installed", "app_not_opened"].includes(typedCode(error))) throw error; fail(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

const WINDOWS_OS_NAMES = new Set(["systemroot", "windir", "comspec", "temp", "tmp", "userprofile", "localappdata", "appdata",
  "programfiles", "programfiles(x86)", "programdata", "allusersprofile", "public", "processor_architecture",
  "number_of_processors", "computername", "os", "pathext", "path", "tz"]);
// Linux: what the AppImage runtime and the server need to find the user's folders, and nothing else.
// (TZ on both: a chat server reads the day in the zone the app reads it in, Brain 2026-10-30)
const LINUX_OS_NAMES = new Set(["home", "path", "user", "logname", "lang", "lc_all", "lc_ctype", "lc_messages", "tmpdir",
  "xdg_data_home", "xdg_config_home", "xdg_cache_home", "xdg_runtime_dir", "appimage_extract_and_run", "tz"]);
const LINUX_APP_ROOT = "@app";
// The fixed launchers of the Linux packages that have one (src/packaged-platform.cjs keeps the same table; this file ships
// alone in the VS Code extension, so it keeps its own copy, and a test keeps the two the same). The snap's follows store
// updates; a versioned /snap/truthspine/<revision>/ path is never accepted.
const LINUX_PACKAGE_COMMANDS = Object.freeze({ "linux-snap": "/snap/bin/truthspine", "linux-system": "/usr/bin/truthspine" });
const linuxPackageCommand = name => (typeof name === "string" && Object.prototype.hasOwnProperty.call(LINUX_PACKAGE_COMMANDS, name) ? LINUX_PACKAGE_COMMANDS[name] : null);
function installedChildEnv({ env, platform, profile, root, hostId, developmentBuild = false }) {
  const childEnv = {};
  const osNames = platform === "linux" ? LINUX_OS_NAMES : WINDOWS_OS_NAMES;
  for (const name of Object.keys(env)) if (osNames.has(name.toLowerCase())) {
    const value = env[name]; if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) fail();
    childEnv[name] = value;
  }
  // A development copy's connections follow the app (owner 2026-10-06): no customer mode, so its data stays where
  // the development app keeps it. A customer package still enforces the boundary from its own release marker.
  Object.assign(childEnv, { ELECTRON_RUN_AS_NODE: "1", TRUTHSPINE_PACKAGED_RUNTIME: "1",
    ...(developmentBuild ? {} : { TRUTHSPINE_CUSTOMER_MODE: "1" }),
    TRUTHSPINE_HOME: profile, ...(root ? { TRUTHSPINE_PROJECT_ROOT: root, TRUTHSPINE_LOCK_PROJECT_ROOT: "1" } : { TRUTHSPINE_FIND_PROJECT: "1" }),
    // (the folder the app started this connection in: a chat's attach may name its own folder; mcp-server.js)
    ...(root && env.TRUTHSPINE_PROJECT_FROM_CWD === "1" ? { TRUTHSPINE_FOLLOWED_FOLDER: "1" } : {}),
    TRUTHSPINE_HOST_ID: hostId,
    TRUTHSPINE_MCP_OUTPUT_FRAMING: "jsonl" });
  // Host identity is a policy selector, not authentication or permission to broaden another host's advertised tool
  // profile. An app HOST_TOOL_PROFILES does not name keeps the full catalog, including session_update.
  if (Object.hasOwn(HOST_TOOL_PROFILES, hostId)) childEnv.TRUTHSPINE_MCP_TOOL_PROFILE = HOST_TOOL_PROFILES[hostId];
  // Preserve an existing restrictive opt-out, never an ambient opt-in or
  // telemetry identity. Dropping an opt-out could enable collection when the
  // registered profile has consent. This grants no product access.
  Object.assign(childEnv, restrictiveTelemetryEnv(env));
  // In particular: no NODE_OPTIONS, NODE_PATH, ambient credentials, authority
  // overrides, or mutable runtime-registration path enters the child.
  return childEnv;
}

function buildInstalledMcpLaunchPlan({ registration, registrationPath, projectRoot,
  platform = process.platform, env = process.env, hostId = "claude-desktop" } = {}) {
  if (!["win32", "darwin", "linux"].includes(platform) || !object(registration)
    || registration.schema !== "truthspine.installed-runtime.v1" || !HOST_IDS.has(hostId)) fail();
  const paths = platform === "win32" ? path.win32 : path.posix;
  // No project (null): an app that starts outside any folder; the connection finds its project (launcherProjectRoot).
  const root = projectRoot === null ? null : absolute(projectRoot, paths), profile = absolute(registration.truthHome, paths);
  const registrationFile = absolute(registrationPath, paths);
  if (root && equal(root, paths.parse(root).root, platform)) fail();
  if (env.TRUTHSPINE_HOME !== undefined && !equal(absolute(env.TRUTHSPINE_HOME, paths), profile, platform)) fail();
  // Root comes from this generated connector, never cwd/last app selection.
  if (platform === "darwin") {
    const userData = paths.dirname(registrationFile);
    const marker = "/Library/Containers/com.timeprooflabs.truthspine/Data/";
    const index = userData.indexOf(marker);
    if (index < 1 || !equal(profile, paths.join(userData, "truthspine"), platform)) fail();
    const dataRoot = userData.slice(0, index + marker.length - 1);
    const hash = crypto.createHash("sha256").update(userData).digest("hex").slice(0, 8);
    // No project (null): the bridge finds it for this connection (local-app-mcp-bridge.js find).
    return Object.freeze({ mode: "app-owned-socket", platform, hostId, projectRoot: root, truthHome: profile,
      socketPath: paths.join(dataRoot, ".ts", `mcp-${hash}.sock`) });
  }
  if (platform === "linux") {
    // Linux packaged lane (P12). The AppImage file, or the package's fixed launcher (the snap's /snap/bin/truthspine), is
    // the one stable path: the app inside an AppImage is mounted under /tmp at a new path on every launch, and a snap's
    // folder changes with each update, so no path inside the package is trusted. The package's own entry point (AppRun,
    // the snap's truthspine-launch) turns a leading "@app/" argument into a path inside it.
    const provenance = registration.runtimeProvenance;
    const command = absolute(registration.command, paths);
    const fixed = object(provenance) ? linuxPackageCommand(provenance.packagedPlatform) : null;
    if (!object(provenance) || provenance.packaged !== true
      || !(provenance.packagedPlatform === "linux-appimage" ? /[.]AppImage$/.test(paths.basename(command)) : fixed !== null && command === fixed)
      || !equal(absolute(provenance.appExecutable, paths), command, platform)) fail();
    return Object.freeze({ mode: "installed-stdio", platform, hostId, packageRoot: LINUX_APP_ROOT, command,
      args: Object.freeze([`${LINUX_APP_ROOT}/src/mcp-server.js`]), cwd: root ?? profile, projectRoot: root, truthHome: profile,
      env: Object.freeze(installedChildEnv({ env, platform, profile, root, hostId,
        developmentBuild: registration.developmentBuild === true })) });
  }
  const packageRoot = absolute(registration.packageRoot, paths);
  const executable = absolute(registration.runtimeProvenance && registration.runtimeProvenance.appExecutable, paths);
  const programFiles = windowsProgramFiles(env, paths);
  const localAppData = absolute(env.LOCALAPPDATA || env.LocalAppData || (env.USERPROFILE && paths.join(env.USERPROFILE, "AppData", "Local")), paths);
  const command = paths.join(localAppData, "Microsoft", "WindowsApps", "truthspine-runtime.exe");
  const install = paths.dirname(executable), packageName = paths.basename(install);
  // Current Store lane only. Other volumes/architectures need OS discovery
  // qualification before widening this routing policy, not a Node fallback.
  if (registration.runtimeProvenance.packaged !== true
    || !/^TimeProofLabsLLC\.TruthSpine_\d+\.\d+\.\d+\.\d+_x64__xzspk04648dda$/.test(packageName)
    || !equal(executable, paths.join(programFiles, "WindowsApps", packageName, "TruthSpine.exe"), platform)
    || !equal(packageRoot, paths.join(install, "resources", "app"), platform)
    || !equal(absolute(registration.command, paths), command, platform)) fail();
  const childEnv = installedChildEnv({ env, platform, profile, root, hostId });
  return Object.freeze({ mode: "installed-stdio", platform, hostId, packageRoot, command, args: Object.freeze([paths.join(packageRoot, "src", "mcp-server.js")]),
    cwd: root ?? profile, projectRoot: root, truthHome: profile, env: Object.freeze(childEnv) });
}

function buildInstalledCliLaunchPlan(options = {}) {
  const args = options.args;
  const commands = new Set(["guard", "nudge", "ask-truthspine", "gap-ledger", "context", "sync", "truth-index",
    "coverage", "review", "app", "license", "onboard", "native-agent-edit", "connector-callback"]);
  if (!Array.isArray(args) || args.length < 1 || args.length > 128
    || !commands.has(args[0])
    || args.some(value => typeof value !== "string" || value.includes("\0") || value.length > 65536
      || /^--project-root(?:=|$)/.test(value))
    || args.reduce((total, value) => total + Buffer.byteLength(value), 0) > 262144) fail();
  const plan = buildInstalledMcpLaunchPlan(options);
  // The Mac CLI is an RPC in the app-owned bridge, never a standalone process; a command always names its project.
  if (plan.mode !== "installed-stdio" || !plan.projectRoot) fail();
  const childEnv = { ...plan.env };
  delete childEnv.TRUTHSPINE_MCP_TOOL_PROFILE;
  delete childEnv.TRUTHSPINE_MCP_OUTPUT_FRAMING;
  return Object.freeze({ ...plan, mode: "installed-cli", env: Object.freeze(childEnv),
    args: Object.freeze([plan.platform === "linux" ? `${LINUX_APP_ROOT}/src/customer-connector-cli.js`
      : path.win32.join(plan.packageRoot, "src", "customer-connector-cli.js"), ...args, "--project-root", plan.projectRoot]) });
}

function validateInstalledLaunchPlan(plan) {
  if (!plan || plan.platform !== process.platform) fail();
  try {
    if (plan.platform === "linux" && ["installed-stdio", "installed-cli"].includes(plan.mode)) {
      // The AppImage must still exist, be a runnable file owned by this user (or root, for a system-wide
      // copy) and not writable by everyone. Group-writable is allowed: Ubuntu's default umask gives it.
      const entry = plan.mode === "installed-cli" ? "customer-connector-cli.js" : "mcp-server.js";
      if (plan.packageRoot !== LINUX_APP_ROOT || plan.args[0] !== `${LINUX_APP_ROOT}/src/${entry}`) fail();
      let image;
      try { image = fs.statSync(plan.command); } catch (error) { if (error && error.code === "ENOENT") typedFail("app_not_installed"); fail(); }
      const uid = typeof process.getuid === "function" ? process.getuid() : null;
      if (!image.isFile() || (image.mode & 0o002) !== 0 || (image.mode & 0o100) === 0
        || (uid !== null && image.uid !== uid && image.uid !== 0) || !fs.statSync(plan.cwd).isDirectory()) fail();
    } else if (["installed-stdio", "installed-cli"].includes(plan.mode)) {
      const entry = plan.mode === "installed-cli" ? "customer-connector-cli.js" : "mcp-server.js";
      const script = plan.args[0];
      if (!equal(script, path.join(plan.packageRoot, "src", entry), process.platform)) fail();
      let installed;
      try { installed = fs.statSync(script); } catch (error) { if (error && error.code === "ENOENT") typedFail("app_not_installed"); fail(); }
      if (!installed.isFile() || !equal(fs.realpathSync(script), script, process.platform)
        || !fs.statSync(plan.cwd).isDirectory()) fail();
      // Do not stat the execution alias: activation may work while stat fails.
    } else if (plan.mode === "app-owned-socket") {
      let socket;
      try { socket = fs.lstatSync(plan.socketPath); } catch (error) { if (error && error.code === "ENOENT") typedFail("app_not_running"); fail(); }
      if (!socket.isSocket() || socket.isSymbolicLink()
        || (typeof process.getuid === "function" && socket.uid !== process.getuid())) fail();
    } else fail();
    return plan;
  } catch (error) { if (typedCode(error)) throw error; fail(); }
}

function relayInstalledMcp(plan, { input = process.stdin, output = process.stdout,
  spawnImpl = spawn, connectImpl = net.createConnection, shutdownMs = 1500 } = {}) {
  if (!Number.isInteger(shutdownMs) || shutdownMs < 1 || shutdownMs > 5000) fail();
  let child, channel, remoteInput, remoteOutput, timer, hardTimer, confirmationTimer;
  let settled = false, reported = false, stopping = false, requestedCode = 0, failureCode = null;
  const noteFailure = (error, code) => { if (!failureCode && error && ["ENOENT", "ECONNREFUSED", "EACCES"].indexOf(error.code) !== -1) failureCode = code; };
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const reportUnconfirmed = () => {
    if (!settled && !reported) {
      reported = true; resolveClosed({ code: 1, pid: child ? child.pid : null, cleanupConfirmed: false });
    }
  };
  const finish = code => {
    if (settled) return;
    settled = true; clearTimeout(timer); clearTimeout(hardTimer); clearTimeout(confirmationTimer);
    input.unpipe(remoteInput); if (remoteOutput) remoteOutput.unpipe(output); input.pause();
    input.removeListener("end", stop); input.removeListener("close", closedInput);
    input.removeListener("error", failed); output.removeListener("error", failed); output.removeListener("close", failed);
    if (!reported) { reported = true; resolveClosed({ code: requestedCode || code, pid: child ? child.pid : null, cleanupConfirmed: true }); }
  };
  function failed() { stop(1); }
  function closedInput() { if (!input.readableEnded) stop(1); }
  function stop(code = 0) {
    if (settled) return;
    requestedCode = requestedCode || code;
    if (stopping) return;
    stopping = true;
    input.unpipe(remoteInput); input.pause();
    if (code && remoteOutput) remoteOutput.unpipe(output);
    if (plan.mode === "app-owned-socket") {
      channel.destroy(); confirmationTimer = setTimeout(reportUnconfirmed, shutdownMs); return;
    }
    if (remoteInput && !remoteInput.destroyed) remoteInput.end();
    timer = setTimeout(() => {
      if (!settled) { try { child.kill(); } catch {} }
      hardTimer = setTimeout(() => {
        if (!settled) { try { child.kill("SIGKILL"); } catch {} }
        confirmationTimer = setTimeout(() => {
          if (!settled && !reported) {
            // A kill request is not terminal evidence. Retain the child's
            // close/error observers and handle; do not claim cleanup or retry.
            reportUnconfirmed();
          }
        }, shutdownMs);
      }, shutdownMs);
    }, shutdownMs);
  }
  try {
    if (plan.mode === "installed-stdio") {
      child = spawnImpl(plan.command, plan.args, { cwd: plan.cwd, env: plan.env, shell: false, windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"] });
      remoteInput = child.stdin; remoteOutput = child.stdout;
      // Never forward raw child diagnostics that may contain credentials.
      child.stderr.on("error", failed); child.stderr.resume();
      child.on("error", error => { noteFailure(error, "app_not_installed"); if (Number.isInteger(child.pid)) failed(); else finish(1); });
      child.on("close", code => finish(code === 0 ? 0 : 1));
      remoteInput.on("error", failed); remoteOutput.on("error", failed);
      remoteOutput.pipe(output, { end: false }); input.pipe(remoteInput);
    } else if (plan.mode === "app-owned-socket") {
      channel = connectImpl(plan.socketPath); remoteInput = channel; remoteOutput = channel;
      channel.on("error", error => { noteFailure(error, "app_not_running"); failed(); });
      channel.on("close", () => finish(stopping ? 0 : 1));
      channel.once("connect", () => {
        if (settled || stopping) return;
        const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", method: "truthspine/bridge/identify",
          params: { hostId: plan.hostId || "claude-desktop", projectRoot: plan.projectRoot || "", ...(plan.projectRoot ? {} : { find: true }) } }));
        channel.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
        channel.pipe(output, { end: false }); input.pipe(channel);
      });
    } else fail();
    input.once("end", stop); input.on("close", closedInput); input.on("error", failed);
    output.on("error", failed); output.on("close", failed);
    if (input.readableEnded) stop();
  } catch { if (child) stop(1); else { if (channel) channel.destroy(); finish(1); } }
  return { closed, stop, pid: child ? child.pid : null, failure: () => failureCode };
}

// Owner's rules 2026-10-08/09: one TruthSpine entry per app, in the app's own user settings, working in whatever
// folder the person is in, and a chat never inherits the project the TruthSpine app shows. TRUTHSPINE_PROJECT_FROM_CWD=1:
// the project is the folder the app started this connection in (bounded: never the home folder or a disk root). An app
// that starts outside any folder (Kiro starts in the home folder) gets null: the connection then finds its project
// from the folders the app has open or the folder the chat names (mcp-server.js TRUTHSPINE_FIND_PROJECT).
// TRUTHSPINE_FIND_PROJECT=1: an app whose working folder is never a project (Claude Desktop, LM Studio, window apps)
// always finds it that way.
function launcherProjectRoot({ env = process.env, cwd, homeDir } = {}) {
  if (env.TRUTHSPINE_FIND_PROJECT === "1") return null;
  if (env.TRUTHSPINE_PROJECT_FROM_CWD !== "1") return env.TRUTHSPINE_PROJECT_ROOT;
  try { return resolveBoundedHostWorkspace({ cwd: cwd ?? process.cwd(), homeDir: homeDir ?? require("node:os").homedir() }).projectRoot; }
  catch { return null; }
}
function installedLauncherOptions() {
  const registrationPath = absolute(process.env.TRUTHSPINE_RUNTIME_REGISTRATION_PATH, path);
  return { registration: readRegistration(registrationPath), registrationPath,
    projectRoot: launcherProjectRoot(),
    hostId: process.env.TRUTHSPINE_LAUNCHER_HOST_ID || "claude-desktop" };
}
function startInstalledMcpLauncher() {
  const plan = buildInstalledMcpLaunchPlan(installedLauncherOptions());
  validateInstalledLaunchPlan(plan);
  return relayInstalledMcp(plan);
}

// The relay (owner 2026-10-16: "fix the claude extension gap too"). A Store update ends every process that runs from the
// TruthSpine package. This launcher runs from outside it when an app starts it with its own Node (Claude Desktop's
// extension), so it survives, but the TruthSpine it started does not, and the connection ended with it. Where the
// TruthSpine app has checked the relay on this computer, such a launcher hands the connection to the relay, which starts
// TruthSpine (through the shared launcher copy, under the Store runtime) and starts the new one after an update.
// Null when that does not apply: not Windows, already a package process, or no checked relay or shared launcher here.
function relayDelegationPlan({ platform = process.platform, execPath = process.execPath, env = process.env,
  exists = file => fs.existsSync(file), readText = file => fs.readFileSync(file, "utf8") } = {}) {
  if (platform !== "win32" || /[\\/]WindowsApps[\\/]/i.test(String(execPath || ""))) return null;
  const registration = env.TRUTHSPINE_RUNTIME_REGISTRATION_PATH;
  if (typeof registration !== "string" || !path.win32.isAbsolute(registration) || /[\x00-\x1f\x7f]/.test(registration)) return null;
  const runtimeFolder = path.win32.join(path.win32.dirname(registration), "connector-runtime");
  let relay = null;
  try {
    const ready = JSON.parse(readText(path.win32.join(runtimeFolder, "relay", "relay-ready.json")));
    relay = ready && ready.ok === true && typeof ready.path === "string" && /[\\/]TruthSpine\.Relay\.exe$/i.test(ready.path) ? ready.path : null;
  } catch { relay = null; }
  const launcher = path.win32.join(runtimeFolder, "installed-mcp-launcher.cjs");
  const localAppData = env.LOCALAPPDATA;
  if (!relay || !exists(relay) || !exists(launcher) || typeof localAppData !== "string" || !path.win32.isAbsolute(localAppData)) return null;
  const runtime = path.win32.join(localAppData, "Microsoft", "WindowsApps", "truthspine-runtime.exe");
  return { mode: "installed-stdio", command: relay, args: ["--", runtime, launcher], cwd: process.cwd(),
    env: { ...env, ELECTRON_RUN_AS_NODE: "1", TRUTHSPINE_PACKAGED_RUNTIME: "1" } };
}

// One process per chat (design approved 2026-10-21; owner: "Keep one runtime, measured budget"). When this launcher
// already runs in the very package its validated plan would start (the same AppImage on Linux, the same Store package
// on Windows), it becomes the chat server itself: the plan's environment exactly, plus the few keys the runtime needs,
// then the package's own mcp-server.js in this process. A second Electron-as-node is no longer started for each chat.
// It still starts one when this launcher runs on another runtime (an app's own Node, the relay), when it was started
// with NODE_OPTIONS, NODE_PATH or Node flags (they would reach the server, which the clean environment keeps out), or
// for the Mac's app-owned socket, which starts no server.
const IN_PLACE_RUNTIME_KEYS = Object.freeze({
  linux: Object.freeze(["APPIMAGE", "APPDIR", "ARGV0", "OWD", "TRUTHSPINE_PACKAGED_PLATFORM"]),
  win32: Object.freeze([])
});
function inPlaceHandover(plan, { platform = process.platform, execPath = process.execPath, env = process.env,
  execArgv = process.execArgv, exists = file => { try { return fs.statSync(file).isFile(); } catch { return false; } } } = {}) {
  if (!plan || plan.mode !== "installed-stdio" || plan.platform !== platform || !IN_PLACE_RUNTIME_KEYS[platform]) return null;
  if (env.ELECTRON_RUN_AS_NODE !== "1" || (env.NODE_OPTIONS ?? "") !== "" || (env.NODE_PATH ?? "") !== "" || execArgv.length) return null;
  const paths = platform === "win32" ? path.win32 : path.posix;
  let serverPath;
  if (platform === "linux") {
    const sameAppImage = typeof env.APPIMAGE === "string" && paths.isAbsolute(env.APPIMAGE) && equal(paths.resolve(env.APPIMAGE), plan.command, platform);
    if (!sameAppImage && linuxPackageCommand(env.TRUTHSPINE_PACKAGED_PLATFORM) !== plan.command) return null;
    if (plan.args[0] !== `${LINUX_APP_ROOT}/src/mcp-server.js`) return null;
    serverPath = paths.join(paths.dirname(execPath), "resources", "app", "src", "mcp-server.js");
  } else {
    if (!equal(paths.join(paths.dirname(execPath), "resources", "app"), plan.packageRoot, platform)) return null;
    serverPath = paths.join(plan.packageRoot, "src", "mcp-server.js");
    if (!equal(plan.args[0], serverPath, platform)) return null;
  }
  if (!exists(serverPath)) return null;
  const next = { ...plan.env };
  for (const key of IN_PLACE_RUNTIME_KEYS[platform]) if (typeof env[key] === "string") next[key] = env[key];
  return Object.freeze({ serverPath, cwd: plan.cwd, env: Object.freeze(next) });
}
// The handover itself: nothing of this launcher's own start environment is left, and the server runs as its own entry.
async function handOverInPlace(handover, { importer = file => import(require("node:url").pathToFileURL(file).href) } = {}) {
  for (const key of Object.keys(process.env)) if (!Object.prototype.hasOwnProperty.call(handover.env, key)) delete process.env[key];
  Object.assign(process.env, handover.env);
  process.chdir(handover.cwd);
  process.argv[1] = handover.serverPath;
  await importer(handover.serverPath);
  return { inPlace: true };
}

// The installed copy's plan, validated; Windows tries the Store package again when the recorded one is gone.
async function installedPlan(signal) {
  const options = installedLauncherOptions();
  let plan = buildInstalledMcpLaunchPlan(options);
  try { validateInstalledLaunchPlan(plan); }
  catch (error) {
    if (plan.platform !== 'win32') throw error;
    plan = (await prepareRecoveredMcpPlan(options, { signal })).plan;
  }
  return plan;
}

// With no TruthSpine to reach (B8, Brain 2026-11-01): the connection stays up and answers by itself, so the chat can say
// "TruthSpine isn't installed yet. Get it here: <link>" instead of the app showing a server that failed. The page opens
// only when the chat calls open_download_page after the person says yes, and once TruthSpine is there the next tool call
// connects this same chat to it (the person's first message is passed on, and the app is told the tools changed).
// A copy that starts but does not answer within NO_ANSWER_MS is given up the same way.
const NO_ANSWER_MS = 10000;
const LAUNCHER_GET_LINKS = Object.freeze({ ...LAUNCHER_STORE_LINKS, linux: "https://truthspine.app/download/linux" });
const DOWNLOAD_PAGE = "https://truthspine.app/download";
function noAppLines(code, platform) {
  const link = LAUNCHER_GET_LINKS[platform] || DOWNLOAD_PAGE;
  if (code === "app_not_installed") return { link, say: `TruthSpine isn't installed yet. Get it here: ${link}`,
    next: "Ask the person whether to open this page now, and call open_download_page only if they say yes. Once TruthSpine is installed and open, call attach again: this chat then connects by itself." };
  const say = code === "app_not_opened" ? "Open TruthSpine once. It is installed on this computer but has not been opened yet, so chats can't reach it."
    : code === "app_not_running" ? "TruthSpine is installed but not running. Open the TruthSpine app, then ask again."
    : "TruthSpine is installed but did not answer. Open the TruthSpine app, then ask again.";
  return { link: null, say, next: "Once it is open, call attach again: this chat then connects by itself." };
}
function openPage(url, platform, spawnImpl = spawn) {
  const [command, args] = platform === "win32" ? ["explorer.exe", [url]] : platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  const child = spawnImpl(command, args, { detached: true, stdio: "ignore", windowsHide: true, shell: false });
  child.on("error", () => {}); child.unref();
}
// Newline-framed JSON-RPC lines from a stream (MCP over standard input and output).
function readLines(stream, onLine) {
  let pending = "";
  const onData = chunk => {
    pending += chunk.toString("utf8");
    let end;
    while ((end = pending.indexOf("\n")) !== -1) { const line = pending.slice(0, end).replace(/\r$/, ""); pending = pending.slice(end + 1); if (line.trim()) onLine(line); }
  };
  stream.on("data", onData);
  return () => stream.removeListener("data", onData);
}
const parse = line => { try { const message = JSON.parse(line); return object(message) ? message : null; } catch { return null; } };

// Relays to the installed copy, and gives it up when it does not answer the app's first request in time (onSilent gets the
// lines it was sent). Lines come in through send(); the copy's answers go to output, the swallowed id's answer excepted.
function answeredRelay(plan, { output, waitMs = NO_ANSWER_MS, onSilent, onAnswered = () => {}, swallowId = null, relay = relayInstalledMcp }) {
  const { PassThrough } = require("node:stream");
  const toCopy = new PassThrough(), fromCopy = new PassThrough();
  const sent = [];
  let waitingFor = undefined, answered = false, gaveUp = false, timer = null;
  const connection = relay(plan, { input: toCopy, output: fromCopy });
  function giveUp() {
    if (gaveUp) return;
    gaveUp = true; clearTimeout(timer); stopReading(); connection.stop(1);
    onSilent(sent.slice());
  }
  const stopReading = readLines(fromCopy, line => {
    if (gaveUp) return;
    const message = parse(line);
    if (message && !answered && waitingFor !== undefined && message.id === waitingFor) { answered = true; clearTimeout(timer); onAnswered(); }
    if (message && swallowId !== null && message.id === swallowId) return;
    output.write(line + "\n");
  });
  // (a copy that ends before it answered is given up too)
  connection.closed.then(result => { if (!answered && !gaveUp && result.code !== 0) giveUp(); });
  return {
    connection,
    send(line) {
      if (gaveUp) return false;
      // (the wait starts with the app's first request: an app may start the connection long before it asks anything)
      if (waitingFor === undefined) {
        const message = parse(line);
        if (message && message.id !== undefined && message.id !== null) { waitingFor = message.id; timer = setTimeout(() => { if (!answered) giveUp(); }, waitMs); }
      }
      if (!answered) sent.push(line);
      toCopy.write(line + "\n");
      return true;
    },
    end() { if (!gaveUp) { clearTimeout(timer); toCopy.end(); } },
    gaveUp: () => gaveUp
  };
}

function serveWithoutApp(code, { input = process.stdin, output = process.stdout, platform = process.platform, attempt,
  waitMs = NO_ANSWER_MS, spawnImpl = spawn, retryEveryMs = 10000, now = () => Date.now(), relay = relayInstalledMcp, earlier = [] } = {}) {
  let resolveClosed, live = null, init = null, lastTry = -Infinity, trying = null, done = false;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const write = message => output.write(JSON.stringify(message) + "\n");
  const lines = () => noAppLines(code, platform);
  const finish = codeOut => { if (done) return; done = true; stopReading(); input.removeListener("end", ended); resolveClosed({ code: codeOut, pid: null, cleanupConfirmed: true }); };
  const ended = () => { if (live) { live.end(); live.connection.closed.then(result => finish(result.code)); } else finish(0); };
  const tools = () => [{ name: "attach", description: `Connect TruthSpine. ${lines().say}`, inputSchema: { type: "object", properties: {}, additionalProperties: true } }]
    .concat(code === "app_not_installed" ? [{ name: "open_download_page", description: "Open the TruthSpine download page in the browser. Call it only after the person says yes.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false } }] : []);
  const answer = message => {
    const { method, id } = message;
    const reply = result => { if (id !== undefined && id !== null) write({ jsonrpc: "2.0", id, result }); };
    if (method === "initialize") {
      init = message;
      return reply({ protocolVersion: (message.params && message.params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "truthspine", version: "not-connected" }, instructions: `${lines().say} ${lines().next}` });
    }
    if (method === "tools/list") return reply({ tools: tools() });
    if (method === "resources/list") return reply({ resources: [] });
    if (method === "prompts/list") return reply({ prompts: [] });
    if (method === "ping") return reply({});
    if (method === "tools/call") {
      const name = message.params && message.params.name;
      if (name === "open_download_page" && code === "app_not_installed") {
        try { openPage(lines().link, platform, spawnImpl); return reply({ content: [{ type: "text", text: `Opened ${lines().link}. ${lines().next}` }] }); }
        catch { return reply({ content: [{ type: "text", text: `Could not open the page. The link is ${lines().link}.` }] }); }
      }
      return reply({ content: [{ type: "text", text: `${lines().say} ${lines().next}` }] });
    }
    if (typeof method === "string" && method.indexOf("notifications/") === 0) return undefined;
    if (id !== undefined && id !== null) write({ jsonrpc: "2.0", id, error: { code: -32601, message: lines().say } });
    return undefined;
  };
  // Once TruthSpine is there: the copy gets the app's first request under its own id (its answer is not passed on, the app
  // has one already), the initialized notice, then the waiting call; the app hears that the tools changed.
  async function connect(callLine) {
    let plan;
    try { plan = await attempt(); } catch (error) { const next = typedCode(error); if (next && next !== code && next !== "unavailable") code = next; return false; }
    if (done) return false;
    const handoverId = `truthspine-handover-${crypto.randomUUID()}`;
    let copy = null;
    const outcome = new Promise(resolve => {
      copy = answeredRelay(plan, { output, waitMs, relay, swallowId: handoverId, onAnswered: () => resolve("answered"),
        onSilent: () => { code = "app_not_answering"; resolve("silent"); } });
    });
    const first = init ? { ...init, id: handoverId } : { jsonrpc: "2.0", id: handoverId, method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "truthspine-launcher", version: "1" } } };
    copy.send(JSON.stringify(first));
    if (await outcome !== "answered" || done) { if (!copy.gaveUp()) copy.connection.stop(1); return false; }
    copy.send(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
    live = copy;
    copy.connection.closed.then(result => finish(result.code));
    write({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
    live.send(callLine);
    return true;
  }
  const onLine = line => {
    if (live) { live.send(line); return; }
    const message = parse(line);
    if (!message) return;
    if (message.method === "tools/call" && !trying && now() - lastTry >= retryEveryMs && !(message.params && message.params.name === "open_download_page")) {
      lastTry = now();
      trying = connect(line).then(connected => { trying = null; if (!connected) answer(message); }, () => { trying = null; answer(message); });
      return;
    }
    if (trying) { trying.then(() => onLine(line)); return; }
    answer(message);
  };
  for (const line of earlier) onLine(line);
  const stopReading = readLines(input, onLine);
  input.once("end", ended);
  if (input.readableEnded) ended();
  return { closed, stop: codeOut => finish(codeOut || 0), pid: null, failure: () => code, withoutApp: true };
}

async function startInstalledMcpLauncherWithRecovery({ signal, inPlace = handOverInPlace, input = process.stdin, output = process.stdout,
  waitMs = NO_ANSWER_MS, relay = relayInstalledMcp } = {}) {
  if (signal?.aborted) fail();
  const delegated = relayDelegationPlan();
  if (delegated) return relayInstalledMcp(delegated);
  let plan;
  try { plan = await installedPlan(signal); }
  catch (error) {
    const code = typedCode(error);
    if (!["app_not_installed", "app_not_opened", "app_not_running"].includes(code)) throw error;
    return serveWithoutApp(code, { input, output, waitMs, relay, attempt: () => installedPlan(signal) });
  }
  if (signal?.aborted) fail();
  // (only a plan that passed validation is ever handed over)
  const handover = inPlaceHandover(plan);
  if (handover) return inPlace(handover);
  if (plan.mode !== "installed-stdio") return relayInstalledMcp(plan);
  // A copy that does not answer the app's first request in time is given up, and this connection answers by itself.
  let resolveClosed, without = null;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  let watched;
  const stopReading = readLines(input, line => { if (without) return; watched.send(line); });
  const ended = () => { if (!without) watched.end(); };
  watched = answeredRelay(plan, { output, waitMs, relay, onSilent: sent => {
    stopReading(); input.removeListener("end", ended);
    without = serveWithoutApp("app_not_answering", { input, output, waitMs, relay, attempt: () => installedPlan(signal), earlier: sent });
    without.closed.then(resolveClosed);
  } });
  input.once("end", ended);
  watched.connection.closed.then(result => { if (!watched.gaveUp()) { stopReading(); resolveClosed(result); } });
  return { closed, stop: code => (without ? without.stop(code) : watched.connection.stop(code)), pid: watched.connection.pid,
    failure: () => (without ? without.failure() : watched.connection.failure()) };
}

// Store package discovery stays in this single-file thin transport so generated
// VS Code and MCPB launchers cannot omit a recovery dependency. Routing only.
const NAME = 'TimeProofLabsLLC.TruthSpine';
const FAMILY = NAME + '_xzspk04648dda';
const PUBLISHER = 'CN=C757D670-5A7C-4F9F-A475-D820CD5AC334';
const recoveryFail = () => { const error = new Error('store_package_recovery_unavailable'); error.code = LAUNCHER_CODE_PREFIX + 'app_not_installed'; throw error; };
function storeVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){3}$/.test(value)) recoveryFail();
  const parts = value.split('.').map(Number);
  if (parts.some(n => n > 65535)) recoveryFail();
  return parts;
}
function storeAbsolute(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]:\\/.test(value) || /[\x00-\x1f\x7f]/.test(value)
    || value !== value.trim() || value.includes('/') || value !== path.win32.normalize(value)) recoveryFail();
  return value;
}
function qualifyCurrentStorePackage({ packages, programFiles, minimumVersion }) {
  if (!Array.isArray(packages) || packages.length !== 1) recoveryFail();
  const row = packages[0], floor = storeVersion(minimumVersion);
  if (!row || typeof row !== 'object' || Array.isArray(row)) recoveryFail();
  const current = storeVersion(row.version);
  const delta = current.map((n, i) => n - floor[i]).find(n => n !== 0) || 0;
  if (delta < 0 || row.name !== NAME || row.family !== FAMILY || row.publisher !== PUBLISHER
    || row.architecture !== 'X64' || row.signatureKind !== 'Store' || row.status !== 'Ok'
    || row.developmentMode !== false || row.partiallyStaged !== false) recoveryFail();
  const fullName = `${NAME}_${row.version}_x64__xzspk04648dda`;
  const expected = path.win32.join(storeAbsolute(programFiles), 'WindowsApps', fullName);
  if (row.fullName !== fullName || storeAbsolute(row.installLocation).toLowerCase() !== expected.toLowerCase()) recoveryFail();
  return Object.freeze({ packageFullName: fullName, version: row.version,
    executable: path.win32.join(expected, 'TruthSpine.exe'), packageRoot: path.win32.join(expected, 'resources', 'app') });
}
// Fixed, read-only command: no registration strings or user arguments enter
// PowerShell source. Current user only; never -AllUsers or elevation.
const DISCOVERY = "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $items=@(Get-AppxPackage -Name TimeProofLabsLLC.TruthSpine | ForEach-Object { @{name=$_.Name;family=$_.PackageFamilyName;publisher=$_.Publisher;version=[string]$_.Version;fullName=$_.PackageFullName;architecture=[string]$_.Architecture;signatureKind=[string]$_.SignatureKind;status=[string]$_.Status;developmentMode=[bool]$_.IsDevelopmentMode;partiallyStaged=[bool]$_.IsPartiallyStaged;installLocation=$_.InstallLocation} }); ConvertTo-Json -InputObject $items -Depth 3 -Compress";
async function discoverCurrentStorePackage({ minimumVersion, signal } = {}) {
  storeVersion(minimumVersion);
  if (process.platform !== 'win32' || signal?.aborted) recoveryFail();
  const systemRoot = storeAbsolute(process.env.SystemRoot || process.env.SYSTEMROOT);
  const programFiles = storeAbsolute(process.env.ProgramFiles || process.env.PROGRAMFILES || process.env.ProgramW6432
    || path.win32.join(path.win32.parse(systemRoot).root, 'Program Files'));
  const executable = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.realpathSync(executable).toLowerCase() !== executable.toLowerCase()) recoveryFail();
  const env = {};
  for (const key of Object.keys(process.env)) {
    if (/^(systemroot|windir|temp|tmp|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|programdata|psmodulepath)$/i.test(key)
      && !/^psmodulepath$/i.test(key)) env[key] = process.env[key];
  }
  // Prevent ambient modules/profile/startup injection. Only built-in Windows
  // PowerShell modules are discoverable; module output is bounded and parsed.
  env.PSModulePath = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  const wire = await new Promise((resolve, reject) => {
    let child, output = '', bytes = 0, failed = false, settled = false, deadline, cleanup;
    const finish = (error, value) => {
      if (settled) return; settled = true;
      clearTimeout(deadline); clearTimeout(cleanup); signal?.removeEventListener('abort', cancel);
      error ? reject(new Error('store_package_recovery_unavailable')) : resolve(value);
    };
    const cancel = () => {
      if (settled || failed) return; failed = true;
      try { child?.kill(); } catch {}
      // Never report successful cleanup or retry when closure is unknown.
      cleanup = setTimeout(() => finish(true), 2000);
    };
    try {
      child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', DISCOVERY],
        { cwd: path.win32.join(systemRoot, 'System32'), env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      deadline = setTimeout(cancel, 10000);
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => { bytes += Buffer.byteLength(chunk); if (bytes > 16384) cancel(); else if (!failed) output += chunk; });
      child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 16384) cancel(); });
      child.stdout.on('error', cancel); child.stderr.on('error', cancel);
      child.on('error', cancel);
      child.on('close', (code, endedBySignal) => finish(failed || code !== 0 || !!endedBySignal, output));
    } catch { cancel(); }
  });
  let packages;
  try { packages = JSON.parse(wire.replace(/^\uFEFF/, '')); } catch { recoveryFail(); }
  return qualifyCurrentStorePackage({ packages, programFiles, minimumVersion });
}
async function prepareRecoveredMcpPlan(options, { signal } = {}) {
  // Validate and snapshot all caller routing before any asynchronous work.
  return prepareRecoveredInstalledPlan(buildInstalledMcpLaunchPlan(options), signal);
}
async function prepareRecoveredCliPlan(options, { signal } = {}) {
  // Snapshot command arguments before discovery, just like workspace/profile.
  return prepareRecoveredInstalledPlan(buildInstalledCliLaunchPlan(options), signal);
}
async function prepareRecoveredInstalledPlan(initial, signal) {
  if (initial.platform !== 'win32' || !['installed-stdio', 'installed-cli'].includes(initial.mode)) recoveryFail();
  // Pin directory identity before awaiting OS discovery. Preserving lexical
  // strings alone would allow a replaced junction/profile to select new data.
  // This is a routing-race check, not ongoing folder authorization or a grant.
  const directories = [initial.projectRoot, initial.truthHome].filter(Boolean);
  const directoryIdentity = directory => {
    try {
      const real = fs.realpathSync(directory);
      const stat = fs.statSync(real, { bigint: true });
      if (!stat.isDirectory() || typeof stat.dev !== 'bigint' || typeof stat.ino !== 'bigint'
        || fs.realpathSync(directory) !== real) recoveryFail();
      return { real, dev: String(stat.dev), ino: String(stat.ino) };
    } catch { recoveryFail(); }
  };
  const originalDirectories = JSON.stringify(directories.map(directoryIdentity));
  const assertDirectories = () => {
    if (JSON.stringify(directories.map(directoryIdentity)) !== originalDirectories) recoveryFail();
  };
  // packageRoot ends resources/app; use its enclosing installation instead.
  const packageName = path.win32.basename(path.win32.dirname(path.win32.dirname(initial.packageRoot)));
  const registered = /^TimeProofLabsLLC\.TruthSpine_(\d+\.\d+\.\d+\.\d+)_x64__xzspk04648dda$/.exec(packageName);
  if (!registered || signal?.aborted) recoveryFail();
  const selected = await discoverCurrentStorePackage({ minimumVersion: registered[1], signal });
  if (signal?.aborted) recoveryFail();
  assertDirectories();
  const entry = initial.mode === 'installed-cli' ? 'customer-connector-cli.js' : 'mcp-server.js';
  const recovered = Object.freeze({ ...initial, packageRoot: selected.packageRoot,
    args: Object.freeze([path.win32.join(selected.packageRoot, 'src', entry), ...initial.args.slice(1)]) });
  validateInstalledLaunchPlan(recovered);
  // Discovery is routing, not a lasting grant. Refuse a package switch while
  // preparing the connection. Native core identity still gates actual work.
  const after = await discoverCurrentStorePackage({ minimumVersion: registered[1], signal });
  if (signal?.aborted || JSON.stringify(after) !== JSON.stringify(selected)) recoveryFail();
  assertDirectories();
  validateInstalledLaunchPlan(recovered);
  return Object.freeze({ plan: recovered, previousVersion: registered[1], package: selected,
    recovered: selected.version !== registered[1] });
}

module.exports = { HOST_IDS, HOST_TOOL_PROFILES, LINUX_PACKAGE_COMMANDS, readRegistration, resolveBoundedHostWorkspace, neverAProjectFolder, scratchFolder, launcherProjectRoot, buildInstalledMcpLaunchPlan, buildInstalledCliLaunchPlan,
  validateInstalledLaunchPlan, restrictiveTelemetryEnv, relayInstalledMcp, relayDelegationPlan, startInstalledMcpLauncher,
  startInstalledMcpLauncherWithRecovery, qualifyCurrentStorePackage, discoverCurrentStorePackage, prepareRecoveredMcpPlan, prepareRecoveredCliPlan,
  LAUNCHER_RESULTS, LAUNCHER_STORE_LINKS, LAUNCHER_GET_LINKS, installedAppPresent, NO_ANSWER_MS, describeLauncherFailure, serveWithoutApp, answeredRelay, inPlaceHandover, handOverInPlace, IN_PLACE_RUNTIME_KEYS };
if (require.main === module) {
  const controller = new AbortController();
  let connection;
  const stop = () => { controller.abort(); connection?.stop(1); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  (async () => {
    connection = await startInstalledMcpLauncherWithRecovery({ signal: controller.signal, inPlace: handover => {
      // (from here this process is the chat server, which handles its own stop: mcp-server.js)
      process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
      return handOverInPlace(handover);
    } });
    if (connection.inPlace) return;
    connection.closed.then(result => {
      process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
      if (result.code !== 0) {
        const code = typeof connection.failure === "function" ? connection.failure() : null;
        process.stderr.write(describeLauncherFailure(code ? { code: LAUNCHER_CODE_PREFIX + code } : null).message + "\n");
      }
      process.exitCode = result.code;
    });
  })().catch(error => {
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    // Only the catalogue sentence is printed; the caught error's own text never reaches stderr.
    process.stderr.write(describeLauncherFailure(error).message + "\n"); process.exitCode = 1;
  });
}
