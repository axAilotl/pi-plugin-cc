---
description: Show active and recent Pi companion jobs for this Claude session
argument-hint: '[job-id] [--wait] [--timeout-ms <ms>] [--all]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" status "$ARGUMENTS"`

Present the command output exactly. With no job ID, keep the returned Markdown table intact. With a job ID, preserve all status, progress, session, result, and cancel details.
