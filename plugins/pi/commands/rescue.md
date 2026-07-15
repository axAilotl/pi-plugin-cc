---
description: Delegate investigation, implementation, or follow-up work to the Pi rescue subagent
argument-hint: '[--background|--wait] [--resume|--fresh] [--model <provider/model>] [--effort <off|minimal|low|medium|high|xhigh>] [task]'
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Invoke the `pi:pi-rescue` subagent with the `Agent` tool using `subagent_type: "pi:pi-rescue"`, forwarding the raw user request as its prompt. This is a subagent, not a skill: do not call `Skill(pi:pi-rescue)` or `Skill(pi:rescue)`. Run it inline so the `Agent` tool remains available.

Raw request:
$ARGUMENTS

- `--background` runs the subagent in Claude Code's background; `--wait` runs it in the foreground; default to foreground for a small bounded task and background for complicated or open-ended work.
- These two flags control Claude execution and are not part of the Pi prompt.
- Preserve `--model`, `--effort`, `--resume`, and `--fresh` as runtime controls.
- If `--resume` or `--fresh` is explicit, do not ask about continuation.
- Otherwise run `node "${CLAUDE_PLUGIN_ROOT}/scripts/pi-companion.mjs" task-resume-candidate --json`. If a candidate exists, ask exactly once whether to `Continue current Pi thread` or `Start a new Pi thread`, recommending continuation for an obvious follow-up and a new thread otherwise. Add `--resume` or `--fresh` based on the answer.

The subagent is a thin forwarder. Return its Pi output verbatim without paraphrasing. Do not ask it to inspect files itself, poll status, fetch results, cancel jobs, or call review commands. If Pi is missing or has no configured model, tell the user to run `/pi:setup`. If no task was supplied, ask what Pi should do.
