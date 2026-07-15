---
description: Show the stored final output for a finished Pi companion job
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" result "$ARGUMENTS"`

Return the complete output exactly as stored. Preserve the Pi session ID and `pi --session <id>` resume command. Do not substitute a Claude-side answer if Pi failed.
