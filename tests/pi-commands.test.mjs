import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = path.join(ROOT, "plugins", "pi");

function read(relative) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relative), "utf8");
}

test("Pi plugin exposes the complete Claude-facing harness", () => {
  assert.deepEqual(fs.readdirSync(path.join(PLUGIN_ROOT, "commands")).sort(), [
    "adversarial-review.md",
    "cancel.md",
    "rescue.md",
    "result.md",
    "review.md",
    "setup.md",
    "status.md"
  ]);
  const manifest = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.equal(manifest.name, "pi");
  assert.equal(manifest.version, "0.1.0");
});

test("Pi review commands preserve the read-only/background contract", () => {
  for (const command of ["review.md", "adversarial-review.md"]) {
    const source = read(`commands/${command}`);
    assert.match(source, /review-only/i);
    assert.match(source, /return Pi's output verbatim/i);
    assert.match(source, /run_in_background:\s*true/);
    assert.match(source, /Do not call `BashOutput`/i);
    assert.match(source, /read-only tool allowlist/i);
    assert.match(source, /pi-companion\.mjs/);
  }
});

test("Pi rescue routes through an explicit thin subagent", () => {
  const rescue = read("commands/rescue.md");
  const agent = read("agents/pi-rescue.md");
  const skill = read("skills/pi-cli-runtime/SKILL.md");
  assert.match(rescue, /subagent_type: "pi:pi-rescue"/);
  assert.match(rescue, /do not call `Skill\(pi:pi-rescue\)`/i);
  assert.match(rescue, /task-resume-candidate --json/);
  assert.match(agent, /thin forwarding wrapper/i);
  assert.match(agent, /Use exactly one Bash call/i);
  assert.match(agent, /Add `--write` by default for explicit implementation\/fix requests/i);
  assert.match(skill, /Without it, the companion enforces the `read,grep,find,ls` tool allowlist/i);
});

test("standalone marketplace exposes only the Pi plugin", () => {
  const marketplace = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"));
  assert.deepEqual(marketplace.plugins.map((plugin) => plugin.name), ["pi"]);
  assert.equal(marketplace.name, "pi-agent-harness");
  assert.equal(marketplace.plugins.find((plugin) => plugin.name === "pi").source, "./plugins/pi");
});
