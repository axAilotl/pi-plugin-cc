import { spawn } from "node:child_process";
import process from "node:process";

import { appendLog, upsertJob } from "./state.mjs";

const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

function messageText(message) {
  if (!message || message.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function summarizeTool(event) {
  const args = event.args && typeof event.args === "object" ? event.args : {};
  switch (event.toolName) {
    case "read": return `Reading ${args.path ?? args.file_path ?? "a file"}`;
    case "edit": return `Editing ${args.path ?? args.file_path ?? "a file"}`;
    case "write": return `Writing ${args.path ?? args.file_path ?? "a file"}`;
    case "grep": return `Searching for ${String(args.pattern ?? "text").slice(0, 80)}`;
    case "find": return `Finding ${String(args.pattern ?? args.glob ?? "files").slice(0, 80)}`;
    case "ls": return `Listing ${args.path ?? "."}`;
    case "bash": return `Running: ${String(args.command ?? "shell command").replace(/\s+/g, " ").slice(0, 160)}`;
    default: return `Calling ${event.toolName ?? "tool"}`;
  }
}

function normalizeThinking(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).toLowerCase() === "none" ? "off" : String(value).toLowerCase();
  if (!THINKING_LEVELS.has(normalized)) {
    throw new Error(`Unsupported Pi thinking level "${value}". Use off, minimal, low, medium, high, or xhigh.`);
  }
  return normalized;
}

export async function runPi(options) {
  const args = ["--mode", "json", "--print", "--no-approve"];
  if (options.sessionId) args.push("--session", options.sessionId);
  if (options.model) args.push("--model", options.model);
  const thinking = normalizeThinking(options.thinking);
  if (thinking) args.push("--thinking", thinking);
  if (!options.write) args.push("--tools", "read,grep,find,ls");
  args.push(options.prompt);

  appendLog(options.logFile, `Starting Pi${options.sessionId ? ` session ${options.sessionId}` : " session"}.`);

  return new Promise((resolve, reject) => {
    const child = spawn("pi", args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    upsertJob(options.cwd, { id: options.jobId, childPid: child.pid ?? null });

    let stdoutBuffer = "";
    let stderr = "";
    let sessionId = options.sessionId ?? null;
    let rawOutput = "";
    let failureMessage = "";
    let usage = null;
    let provider = null;
    let model = null;

    const handleRecord = (line) => {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        appendLog(options.logFile, `Unparseable Pi output: ${line.slice(0, 240)}`);
        return;
      }
      if (event.type === "session" && event.id) {
        sessionId = event.id;
        upsertJob(options.cwd, { id: options.jobId, piSessionId: sessionId, phase: "running" });
        appendLog(options.logFile, `Pi session ready: ${sessionId}`);
      } else if (event.type === "tool_execution_start") {
        const progress = summarizeTool(event);
        upsertJob(options.cwd, { id: options.jobId, phase: event.toolName === "edit" || event.toolName === "write" ? "editing" : "investigating", progress });
        appendLog(options.logFile, progress);
      } else if (event.type === "tool_execution_end" && event.isError) {
        appendLog(options.logFile, `${event.toolName ?? "Tool"} returned an error.`);
      } else if (event.type === "auto_retry_start") {
        appendLog(options.logFile, `Retrying model request (${event.attempt}/${event.maxAttempts}).`);
      } else if (event.type === "message_end" && event.message?.role === "assistant") {
        const text = messageText(event.message);
        if (text) rawOutput = text;
        usage = event.message.usage ?? usage;
        provider = event.message.provider ?? provider;
        model = event.message.model ?? model;
        if (event.message.stopReason === "error" || event.message.stopReason === "aborted") {
          failureMessage = event.message.errorMessage || `Pi request ${event.message.stopReason}.`;
        }
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      let newline;
      while ((newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).replace(/\r$/, "");
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        handleRecord(line);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
      for (const line of text.split(/\r?\n/).filter(Boolean)) appendLog(options.logFile, `stderr: ${line}`);
    });

    let interrupted = false;
    const interrupt = () => {
      interrupted = true;
      try { child.kill("SIGTERM"); } catch {}
    };
    process.once("SIGTERM", interrupt);
    if (process.platform !== "win32") process.once("SIGHUP", interrupt);

    child.on("error", (error) => {
      process.off("SIGTERM", interrupt);
      if (process.platform !== "win32") process.off("SIGHUP", interrupt);
      reject(error);
    });
    child.on("close", (code, signal) => {
      process.off("SIGTERM", interrupt);
      if (process.platform !== "win32") process.off("SIGHUP", interrupt);
      if (stdoutBuffer.trim()) handleRecord(stdoutBuffer.replace(/\r$/, ""));
      const exitStatus = interrupted || signal || code !== 0 || failureMessage ? 1 : 0;
      resolve({
        exitStatus,
        code,
        signal,
        sessionId,
        rawOutput,
        failureMessage: failureMessage || (exitStatus ? stderr.trim() || `Pi exited with status ${code ?? signal ?? "unknown"}.` : ""),
        stderr: stderr.trim(),
        usage,
        provider,
        model
      });
    });
  });
}
