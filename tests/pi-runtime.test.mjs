import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { installFakePi } from "./fake-pi-fixture.mjs";
import { initGitRepo, makeTempDir, run } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "plugins", "pi", "scripts", "pi-companion.mjs");

function fixture() {
  const root = makeTempDir("pi-plugin-test-");
  const repo = path.join(root, "repo");
  const bin = path.join(root, "bin");
  const pluginData = path.join(root, "plugin-data");
  const fakeState = path.join(root, "fake-pi-state.json");
  fs.mkdirSync(repo, { recursive: true });
  installFakePi(bin);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "package.json"), '{"name":"fixture"}\n');
  run("git", ["add", "package.json"], { cwd: repo });
  run("git", ["commit", "-m", "initial"], { cwd: repo });
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    CLAUDE_PLUGIN_DATA: pluginData,
    PI_COMPANION_SESSION_ID: "claude-session-1",
    PI_CODING_AGENT_DIR: path.join(root, "pi-agent"),
    FAKE_PI_STATE: fakeState
  };
  return { root, repo, env, fakeState };
}

test("setup detects an installed Pi with an available model", () => {
  const { repo, env } = fixture();
  const result = run("node", [SCRIPT, "setup", "--json"], { cwd: repo, env });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ready, true);
  assert.equal(payload.pi.detail, "0.79.6");
  assert.equal(payload.modelCount, 1);
});

test("read-only task persists output and Pi session metadata", () => {
  const { repo, env, fakeState } = fixture();
  const task = run("node", [SCRIPT, "task", "--json", "diagnose the fixture"], { cwd: repo, env });
  assert.equal(task.status, 0, task.stderr);
  const payload = JSON.parse(task.stdout);
  assert.equal(payload.job.status, "completed");
  assert.equal(payload.job.piSessionId, "pi-session-1");
  assert.equal(payload.execution.rawOutput, "Fake Pi completed.");

  const fake = JSON.parse(fs.readFileSync(fakeState, "utf8"));
  assert.ok(fake.runs[0].args.includes("--no-approve"));
  assert.deepEqual(fake.runs[0].args.slice(fake.runs[0].args.indexOf("--tools"), fake.runs[0].args.indexOf("--tools") + 2), ["--tools", "read,grep,find,ls"]);

  const status = run("node", [SCRIPT, "status"], { cwd: repo, env });
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /pi-rescue-/);
  assert.match(status.stdout, /pi-session-1/);
  const stored = run("node", [SCRIPT, "result"], { cwd: repo, env });
  assert.match(stored.stdout, /Fake Pi completed\./);
  assert.match(stored.stdout, /pi --session pi-session-1/);
});

test("write and resume controls map to Pi CLI arguments", () => {
  const { repo, env, fakeState } = fixture();
  const first = run("node", [SCRIPT, "task", "--write", "--json", "implement the fixture"], { cwd: repo, env });
  assert.equal(first.status, 0, first.stderr);
  const second = run("node", [SCRIPT, "task", "--resume-last", "--model", "fake/model", "--effort", "high", "--json", "continue"], { cwd: repo, env });
  assert.equal(second.status, 0, second.stderr);
  const fake = JSON.parse(fs.readFileSync(fakeState, "utf8"));
  assert.equal(fake.runs.length, 2);
  assert.equal(fake.runs[0].args.includes("--tools"), false);
  assert.deepEqual(fake.runs[1].args.slice(fake.runs[1].args.indexOf("--session"), fake.runs[1].args.indexOf("--session") + 2), ["--session", "pi-session-1"]);
  assert.deepEqual(fake.runs[1].args.slice(fake.runs[1].args.indexOf("--model"), fake.runs[1].args.indexOf("--model") + 2), ["--model", "fake/model"]);
  assert.deepEqual(fake.runs[1].args.slice(fake.runs[1].args.indexOf("--thinking"), fake.runs[1].args.indexOf("--thinking") + 2), ["--thinking", "high"]);
});

test("review writes a diff artifact and invokes Pi read-only", () => {
  const { repo, env, fakeState } = fixture();
  fs.writeFileSync(path.join(repo, "package.json"), '{"name":"changed"}\n');
  const review = run("node", [SCRIPT, "review", "--wait", "--json"], { cwd: repo, env });
  assert.equal(review.status, 0, review.stderr);
  const payload = JSON.parse(review.stdout);
  assert.equal(payload.job.kind, "review");
  assert.ok(fs.existsSync(payload.job.contextFile));
  assert.match(fs.readFileSync(payload.job.contextFile, "utf8"), /-\{"name":"fixture"\}/);
  assert.match(fs.readFileSync(payload.job.contextFile, "utf8"), /\+\{"name":"changed"\}/);
  const fake = JSON.parse(fs.readFileSync(fakeState, "utf8"));
  assert.ok(fake.runs[0].args.includes("read,grep,find,ls"));
  assert.ok(fake.runs[0].args.at(-1).includes(payload.job.contextFile));
});

test("session hook exports the Pi companion session id", () => {
  const { root, repo, env } = fixture();
  const envFile = path.join(root, "claude-env.sh");
  const hook = path.join(ROOT, "plugins", "pi", "scripts", "session-lifecycle-hook.mjs");
  const result = run("node", [hook, "SessionStart"], {
    cwd: repo,
    env: { ...env, CLAUDE_ENV_FILE: envFile },
    input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "session-from-hook", cwd: repo })
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(envFile, "utf8"), /export PI_COMPANION_SESSION_ID='session-from-hook'/);
});
