# Pi companion plugin

This Claude Code plugin runs the [Pi agent harness](https://github.com/earendil-works/pi) as an independent reviewer or delegated coding agent.

It provides `/pi:setup`, `/pi:review`, `/pi:adversarial-review`, `/pi:rescue`, `/pi:status`, `/pi:result`, and `/pi:cancel`, plus the proactive `pi:pi-rescue` subagent. Pi session IDs are persisted for follow-up work and direct continuation with `pi --session <id>`.

This is an unofficial adaptation of [OpenAI's Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc), retaining its Apache-2.0 lineage while replacing the Codex runtime with Pi's JSON event stream and session interface.

See the [repository README](../../README.md) for installation, usage, safety details, and attribution.
