---
description: Check whether the local Pi agent harness is installed and has a configured model
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" setup --json
```

If Pi is unavailable, use `AskUserQuestion` exactly once to ask whether Claude should install it now. Put `Install Pi (Recommended)` first and `Skip for now` second. If selected, run:

```bash
npm install -g @earendil-works/pi-coding-agent
```

Then rerun setup. If Pi is installed but has no configured models, preserve the instruction to run `!pi` and use `/login`. Present the final setup output without inventing alternate authentication steps.
