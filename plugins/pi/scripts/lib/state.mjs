import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { processIsAlive } from "./process.mjs";
import { resolveWorkspaceRoot } from "./workspace.mjs";

export const PI_SESSION_ENV = "PI_COMPANION_SESSION_ID";
const MAX_JOBS = 50;

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return { version: 1, jobs: [] };
}

export function resolveStateDir(cwd) {
  const workspace = resolveWorkspaceRoot(cwd);
  let canonical = workspace;
  try { canonical = fs.realpathSync.native(workspace); } catch {}
  const slug = (path.basename(workspace) || "workspace").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  const root = process.env.CLAUDE_PLUGIN_DATA
    ? path.join(process.env.CLAUDE_PLUGIN_DATA, "pi-state")
    : path.join(os.tmpdir(), "pi-companion");
  return path.join(root, `${slug}-${hash}`);
}

function stateFile(cwd) {
  return path.join(resolveStateDir(cwd), "state.json");
}

export function jobsDir(cwd) {
  return path.join(resolveStateDir(cwd), "jobs");
}

function ensureDirs(cwd) {
  fs.mkdirSync(jobsDir(cwd), { recursive: true });
}

export function loadState(cwd) {
  const file = stateFile(cwd);
  if (!fs.existsSync(file)) return defaultState();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ...defaultState(), ...parsed, jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
  } catch {
    return defaultState();
  }
}

export function saveState(cwd, state) {
  ensureDirs(cwd);
  const jobs = [...(state.jobs ?? [])]
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
    .slice(0, MAX_JOBS);
  const file = stateFile(cwd);
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify({ version: 1, jobs }, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
  return { version: 1, jobs };
}

export function updateState(cwd, mutate) {
  const state = loadState(cwd);
  mutate(state);
  return saveState(cwd, state);
}

export function upsertJob(cwd, patch) {
  return updateState(cwd, (state) => {
    const index = state.jobs.findIndex((job) => job.id === patch.id);
    const timestamps = index === -1 ? { createdAt: nowIso() } : {};
    const next = { ...(index === -1 ? {} : state.jobs[index]), ...timestamps, ...patch, updatedAt: nowIso() };
    if (index === -1) state.jobs.unshift(next);
    else state.jobs[index] = next;
  });
}

export function generateJobId(prefix = "pi") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function jobFile(cwd, jobId) {
  ensureDirs(cwd);
  return path.join(jobsDir(cwd), `${jobId}.json`);
}

export function logFile(cwd, jobId) {
  ensureDirs(cwd);
  return path.join(jobsDir(cwd), `${jobId}.log`);
}

export function artifactFile(cwd, jobId, suffix) {
  ensureDirs(cwd);
  return path.join(jobsDir(cwd), `${jobId}-${suffix}`);
}

export function writeJob(cwd, jobId, value) {
  fs.writeFileSync(jobFile(cwd, jobId), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJob(cwd, jobId) {
  const file = jobFile(cwd, jobId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function appendLog(file, message) {
  const text = String(message ?? "").trim();
  if (text) fs.appendFileSync(file, `[${nowIso()}] ${text}\n`, "utf8");
}

export function listJobs(cwd, options = {}) {
  const currentSession = process.env[PI_SESSION_ENV] || null;
  const state = loadState(cwd);
  let changed = false;
  for (const job of state.jobs) {
    if ((job.status === "running" || job.status === "queued") && job.pid && !processIsAlive(job.pid)) {
      job.status = "failed";
      job.phase = "failed";
      job.errorMessage = job.errorMessage || "Pi companion process exited before recording a result.";
      job.completedAt = job.completedAt || nowIso();
      job.pid = null;
      job.childPid = null;
      job.updatedAt = nowIso();
      changed = true;
    }
  }
  if (changed) saveState(cwd, state);
  const selected = options.allSessions || !currentSession
    ? state.jobs
    : state.jobs.filter((job) => job.claudeSessionId === currentSession);
  return [...selected].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
}

export function resolveJob(cwd, reference, predicate = () => true, options = {}) {
  const jobs = listJobs(cwd, options).filter(predicate);
  if (!reference) return jobs[0] ?? null;
  const exact = jobs.find((job) => job.id === reference);
  if (exact) return exact;
  const matches = jobs.filter((job) => job.id.startsWith(reference));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error(`Job reference "${reference}" is ambiguous.`);
  throw new Error(`No Pi job found for "${reference}".`);
}

export function removeSessionJobs(cwd, claudeSessionId) {
  if (!claudeSessionId) return [];
  const state = loadState(cwd);
  const removed = state.jobs.filter((job) => job.claudeSessionId === claudeSessionId);
  saveState(cwd, { ...state, jobs: state.jobs.filter((job) => job.claudeSessionId !== claudeSessionId) });
  return removed;
}
