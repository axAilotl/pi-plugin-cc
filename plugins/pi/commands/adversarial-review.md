---
description: Run a steerable, adversarial, read-only Pi review
argument-hint: '[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [--model <provider/model>] [--effort <level>] [focus ...]'
disable-model-invocation: true
allowed-tools: Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an adversarial review through the Pi companion. This command is review-only: do not fix issues or edit files, and return Pi's output verbatim.

Raw arguments: `$ARGUMENTS`

Execution selection:

- If `--wait` is present, run in the foreground.
- If `--background` is present, run with Claude Code's `Bash(..., run_in_background: true)` and do not call `BashOutput` in this turn.
- Otherwise inspect `git status --short --untracked-files=all`, `git diff --shortstat --cached`, and `git diff --shortstat`. Recommend foreground only for a clearly tiny review of roughly one or two files; recommend background otherwise. Ask once with `Wait for results` and `Run in background`, putting `(Recommended)` on the first option.

Foreground command:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" adversarial-review "$ARGUMENTS"
```

Background call:

```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" adversarial-review "$ARGUMENTS"`,
  description: "Pi adversarial review",
  run_in_background: true
})
```

After a background launch, say: "Pi adversarial review started in the background. Check `/pi:status` for progress."

The companion enforces Pi's read-only tool allowlist and uses the same working-tree/branch selection as `/pi:review`. Preserve the user's focus text exactly.
