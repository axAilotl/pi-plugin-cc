import fs from "node:fs";
import path from "node:path";

import { runCommand, runCommandChecked } from "./process.mjs";

const MAX_UNTRACKED_FILE_BYTES = 64 * 1024;
const MAX_UNTRACKED_TOTAL_BYTES = 2 * 1024 * 1024;

function git(cwd, args) {
  return runCommandChecked("git", args, { cwd }).stdout;
}

function section(title, body) {
  return `## ${title}\n\n${String(body ?? "").trim() || "(none)"}\n`;
}

function lines(text) {
  return String(text).trim().split(/\r?\n/).filter(Boolean);
}

function ensureRepo(cwd) {
  const result = runCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.error?.code === "ENOENT") throw new Error("git is not installed.");
  if (result.status !== 0) throw new Error("Pi review must run inside a Git repository.");
  return result.stdout.trim();
}

function defaultBranch(cwd) {
  const symbolic = runCommand("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
  if (symbolic.status === 0) return symbolic.stdout.trim().replace(/^refs\/remotes\/origin\//, "");
  for (const candidate of ["main", "master", "trunk"]) {
    if (runCommand("git", ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`], { cwd }).status === 0) {
      return candidate;
    }
    if (runCommand("git", ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${candidate}`], { cwd }).status === 0) {
      return `origin/${candidate}`;
    }
  }
  throw new Error("Unable to detect the default branch. Pass --base <ref> or --scope working-tree.");
}

function workingTreeFiles(cwd) {
  return {
    staged: lines(git(cwd, ["diff", "--cached", "--name-only"])),
    unstaged: lines(git(cwd, ["diff", "--name-only"])),
    untracked: lines(git(cwd, ["ls-files", "--others", "--exclude-standard"]))
  };
}

function isText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return !sample.includes(0);
}

function untrackedContext(cwd, files) {
  const parts = [];
  let total = 0;
  for (const relative of files) {
    const absolute = path.join(cwd, relative);
    let stat;
    try { stat = fs.statSync(absolute); } catch {
      parts.push(`### ${relative}\n(skipped: unreadable)`);
      continue;
    }
    if (!stat.isFile()) {
      parts.push(`### ${relative}\n(skipped: not a regular file)`);
      continue;
    }
    if (stat.size > MAX_UNTRACKED_FILE_BYTES || total + stat.size > MAX_UNTRACKED_TOTAL_BYTES) {
      parts.push(`### ${relative}\n(skipped: ${stat.size} bytes; inspect the file with the read tool)`);
      continue;
    }
    const buffer = fs.readFileSync(absolute);
    if (!isText(buffer)) {
      parts.push(`### ${relative}\n(skipped: binary)`);
      continue;
    }
    total += buffer.length;
    parts.push(`### ${relative}\n\n\`\`\`\n${buffer.toString("utf8").trimEnd()}\n\`\`\``);
  }
  return parts.join("\n\n");
}

function collectWorkingTree(cwd) {
  const state = workingTreeFiles(cwd);
  const changedFiles = [...new Set([...state.staged, ...state.unstaged, ...state.untracked])].sort();
  return {
    targetLabel: "working tree diff",
    changedFiles,
    content: [
      section("Git Status", git(cwd, ["status", "--short", "--untracked-files=all"])),
      section("Staged Diff", git(cwd, ["diff", "--cached", "--binary", "--no-ext-diff", "--submodule=diff"])),
      section("Unstaged Diff", git(cwd, ["diff", "--binary", "--no-ext-diff", "--submodule=diff"])),
      section("Untracked Files", untrackedContext(cwd, state.untracked))
    ].join("\n")
  };
}

function collectBranch(cwd, base) {
  const mergeBase = git(cwd, ["merge-base", "HEAD", base]).trim();
  const range = `${mergeBase}..HEAD`;
  const changedFiles = lines(git(cwd, ["diff", "--name-only", range]));
  return {
    targetLabel: `branch diff against ${base}`,
    changedFiles,
    content: [
      section("Comparison", `Base: ${base}\nMerge base: ${mergeBase}\nRange: ${range}`),
      section("Commit Log", git(cwd, ["log", "--oneline", "--decorate", range])),
      section("Diff Stat", git(cwd, ["diff", "--stat", range])),
      section("Branch Diff", git(cwd, ["diff", "--binary", "--no-ext-diff", "--submodule=diff", range]))
    ].join("\n")
  };
}

export function collectReviewContext(cwd, options = {}) {
  const repoRoot = ensureRepo(cwd);
  const scope = options.scope ?? "auto";
  if (!["auto", "working-tree", "branch"].includes(scope)) {
    throw new Error(`Unsupported review scope "${scope}". Use auto, working-tree, branch, or --base <ref>.`);
  }

  let result;
  if (options.base) {
    result = collectBranch(repoRoot, options.base);
  } else if (scope === "working-tree") {
    result = collectWorkingTree(repoRoot);
  } else if (scope === "branch") {
    result = collectBranch(repoRoot, defaultBranch(repoRoot));
  } else {
    const state = workingTreeFiles(repoRoot);
    const dirty = state.staged.length + state.unstaged.length + state.untracked.length > 0;
    result = dirty ? collectWorkingTree(repoRoot) : collectBranch(repoRoot, defaultBranch(repoRoot));
  }

  return {
    repoRoot,
    ...result,
    byteLength: Buffer.byteLength(result.content, "utf8")
  };
}
