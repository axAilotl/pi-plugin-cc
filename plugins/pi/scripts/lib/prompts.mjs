import fs from "node:fs";
import path from "node:path";

export function loadPrompt(rootDir, name, replacements = {}) {
  let source = fs.readFileSync(path.join(rootDir, "prompts", `${name}.md`), "utf8");
  for (const [key, value] of Object.entries(replacements)) {
    source = source.replaceAll(`{{${key}}}`, String(value));
  }
  return source.trim();
}
