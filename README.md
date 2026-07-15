# Pi plugin for Claude Code

Use the [Pi agent harness](https://github.com/earendil-works/pi) from inside Claude Code for independent code reviews, diagnosis, and delegated implementation.

> [!IMPORTANT]
> This repository is an unofficial fork of [OpenAI's Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc). It adapts the Codex companion's Claude Code plugin architecture and job-management UX to run Pi instead. It is not affiliated with or endorsed by OpenAI, Anthropic, or the Pi maintainers.

## What you get

- `/pi:review` for a normal read-only review
- `/pi:adversarial-review` for a focused challenge review
- `/pi:rescue` for delegated investigation or implementation
- `/pi:status`, `/pi:result`, and `/pi:cancel` for long-running jobs
- the proactive `pi:pi-rescue` subagent for direct Claude-to-Pi delegation
- persistent Pi session IDs and `--resume` support

Together with Claude Code itself and the original Codex plugin, this gives Claude three agent harnesses to call on.

## Requirements

- Claude Code with plugin support
- Node.js 22.19 or later
- `@earendil-works/pi-coding-agent` installed on `PATH`
- at least one Pi provider/model configured

Install Pi if needed:

```bash
npm install -g @earendil-works/pi-coding-agent
```

Run `pi`, then use `/login` to configure a subscription or API-key provider.

## Install

In Claude Code:

```text
/plugin marketplace add axAilotl/pi-plugin-cc
/plugin install pi@pi-agent-harness
/reload-plugins
/pi:setup
```

## Usage

### Review changes

```text
/pi:review --background
/pi:review --base main --wait
/pi:adversarial-review --base main challenge the concurrency and rollback design
```

Review commands collect the relevant Git diff into an artifact and start Pi with only `read`, `grep`, `find`, and `ls` enabled.

### Delegate work

```text
/pi:rescue --wait investigate why the integration test is flaky
/pi:rescue --background fix the flaky test and verify the smallest safe patch
/pi:rescue --resume apply the strongest fix from the last Pi run
```

Diagnosis, research, and review tasks remain read-only. Explicit fix or implementation tasks are write-capable.

### Manage background jobs

```text
/pi:status
/pi:status <job-id>
/pi:result <job-id>
/pi:cancel <job-id>
```

Completed results include a Pi session ID and a direct `pi --session <id>` continuation command.

## Safety model

Pi does not include a built-in OS permission sandbox. The companion therefore:

- starts Pi with `--no-approve` so project-local Pi extensions are not trusted automatically;
- uses Pi's explicit read-only tool allowlist for reviews and non-writing rescue work;
- enables Pi's normal write-capable tools only for delegated implementation tasks.

Write-capable runs still have the permissions of the user launching Pi. Use a container or sandbox when stronger isolation is required.

## Fork lineage

This fork retains the upstream Git history, Apache-2.0 license, and OpenAI NOTICE attribution. The Pi adaptation replaces the Codex app-server runtime with Pi's JSON event stream and session interface while keeping the useful Claude Code command, subagent, background-job, result, and cancellation patterns.

The Pi integration itself was written for this fork; no Pi source code is vendored here.

## Development

```bash
npm ci
npm test
npm run check-version
claude plugin validate --strict plugins/pi
claude plugin validate --strict .
```

Tests use a fake Pi executable and do not consume provider tokens.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
