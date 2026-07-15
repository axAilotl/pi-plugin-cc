import fs from "node:fs";
import path from "node:path";

import { runCommand } from "./process.mjs";

export function resolveWorkspaceRoot(cwd) {
  const start = path.resolve(cwd || process.cwd());
  const result = runCommand("git", ["rev-parse", "--show-toplevel"], { cwd: start });
  if (!result.error && result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  try {
    return fs.realpathSync.native(start);
  } catch {
    return start;
  }
}
