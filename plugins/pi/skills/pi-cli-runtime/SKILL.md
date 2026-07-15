---
name: pi-cli-runtime
description: Internal contract for forwarding work from the pi-rescue subagent to the Pi companion
user-invocable: false
---

# Pi Runtime

Use this skill only inside `pi:pi-rescue`.

Invoke exactly one command:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" task [runtime flags] "<task>"
```

The subagent is a forwarder, not an orchestrator. Do not inspect the repository or call any helper except `task`.

- Strip `--background` and `--wait` before calling the helper.
- Pass an explicit `--model <provider/model>` and `--effort <level>` through. Pi levels are `off`, `minimal`, `low`, `medium`, `high`, and `xhigh`; `none` is accepted as an alias for `off`.
- Convert `--resume` to `--resume-last`. A `--fresh` run omits resume flags.
- Add `--write` only when the user wants edits or implementation. Without it, the companion enforces the `read,grep,find,ls` tool allowlist.
- Preserve task text after stripping runtime controls.
- Return stdout unchanged. Never generate a substitute response if Pi fails.
