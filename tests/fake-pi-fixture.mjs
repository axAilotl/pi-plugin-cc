import fs from "node:fs";
import path from "node:path";

import { writeExecutable } from "./helpers.mjs";

export function installFakePi(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const executable = path.join(binDir, process.platform === "win32" ? "pi.cmd" : "pi");
  if (process.platform === "win32") {
    throw new Error("The fake Pi fixture currently requires a POSIX test environment.");
  }
  writeExecutable(executable, `#!/usr/bin/env node
const fs = require("node:fs");

const args = process.argv.slice(2);
if (args.includes("--version")) {
  process.stdout.write("0.79.6\\n");
  process.exit(0);
}
if (args.includes("--list-models")) {
  process.stdout.write("provider  model  context  max-out  thinking  images\\n");
  process.stdout.write("fake      model  128K     32K      yes       no\\n");
  process.exit(0);
}

const stateFile = process.env.FAKE_PI_STATE;
let state = { runs: [] };
try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch {}
const sessionIndex = args.indexOf("--session");
const sessionId = sessionIndex === -1 ? "pi-session-" + (state.runs.length + 1) : args[sessionIndex + 1];
state.runs.push({ args, cwd: process.cwd(), sessionId });
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

const emit = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
emit({ type: "session", version: 3, id: sessionId, cwd: process.cwd() });
emit({ type: "agent_start" });
emit({ type: "tool_execution_start", toolCallId: "tool-1", toolName: "read", args: { path: "package.json" } });
emit({ type: "tool_execution_end", toolCallId: "tool-1", toolName: "read", isError: false, result: {} });
const failed = process.env.FAKE_PI_ERROR === "1";
emit({
  type: "message_end",
  message: {
    role: "assistant",
    content: failed ? [] : [{ type: "text", text: "Fake Pi completed." }],
    provider: "fake",
    model: "model",
    stopReason: failed ? "error" : "stop",
    errorMessage: failed ? "Fake provider failure" : undefined,
    usage: { input: 10, output: 5, totalTokens: 15, cost: { total: 0 } }
  }
});
emit({ type: "agent_end", messages: [] });
`);
  return executable;
}
