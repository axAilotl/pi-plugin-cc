import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { makeTempDir, run } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "bump-version.mjs");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fixture() {
  const root = makeTempDir("pi-version-test-");
  writeJson(path.join(root, "package.json"), { name: "pi-plugin-cc", version: "0.1.0" });
  writeJson(path.join(root, "package-lock.json"), {
    name: "pi-plugin-cc",
    version: "0.1.0",
    packages: { "": { name: "pi-plugin-cc", version: "0.1.0" } }
  });
  writeJson(path.join(root, "plugins/pi/.claude-plugin/plugin.json"), { name: "pi", version: "0.1.0" });
  writeJson(path.join(root, ".claude-plugin/marketplace.json"), {
    metadata: { version: "0.1.0" },
    plugins: [{ name: "pi", version: "0.1.0" }]
  });
  return root;
}

test("bump-version updates all Pi release manifests", () => {
  const root = fixture();
  const result = run("node", [SCRIPT, "--root", root, "0.2.0"], { cwd: ROOT });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJson(path.join(root, "package.json")).version, "0.2.0");
  assert.equal(readJson(path.join(root, "package-lock.json")).version, "0.2.0");
  assert.equal(readJson(path.join(root, "package-lock.json")).packages[""].version, "0.2.0");
  assert.equal(readJson(path.join(root, "plugins/pi/.claude-plugin/plugin.json")).version, "0.2.0");
  assert.equal(readJson(path.join(root, ".claude-plugin/marketplace.json")).metadata.version, "0.2.0");
  assert.equal(readJson(path.join(root, ".claude-plugin/marketplace.json")).plugins[0].version, "0.2.0");
});

test("check mode reports stale Pi plugin metadata", () => {
  const root = fixture();
  writeJson(path.join(root, "package.json"), { name: "pi-plugin-cc", version: "0.1.1" });
  const result = run("node", [SCRIPT, "--root", root, "--check"], { cwd: ROOT });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /plugins\/pi\/\.claude-plugin\/plugin\.json version/);
  assert.match(result.stderr, /marketplace\.json metadata\.version/);
});
