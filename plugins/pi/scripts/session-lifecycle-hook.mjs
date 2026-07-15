#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PI_SESSION_ENV } from "./lib/state.mjs";

function input() {
  const raw = fs.readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function exportVariable(name, value) {
  if (!process.env.CLAUDE_ENV_FILE || value == null || value === "") return;
  fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export ${name}=${shellEscape(value)}\n`, "utf8");
}

const data = input();
const eventName = process.argv[2] || data.hook_event_name;
if (eventName === "SessionStart") {
  exportVariable(PI_SESSION_ENV, data.session_id);
  exportVariable("CLAUDE_PLUGIN_DATA", process.env.CLAUDE_PLUGIN_DATA);
} else if (eventName === "SessionEnd") {
  const companion = fileURLToPath(new URL("./pi-companion.mjs", import.meta.url));
  spawnSync(process.execPath, [companion, "cleanup-session", "--cwd", data.cwd || process.cwd(), "--session-id", data.session_id || process.env[PI_SESSION_ENV] || ""], {
    cwd: data.cwd || process.cwd(),
    env: process.env,
    stdio: "ignore",
    windowsHide: true
  });
}
