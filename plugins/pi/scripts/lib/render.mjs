function duration(start, end = null) {
  const startMs = Date.parse(start ?? "");
  const endMs = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "";
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function renderSetup(report) {
  const lines = [
    "# Pi Setup", "",
    `Status: ${report.ready ? "ready" : "needs attention"}`, "",
    "Checks:",
    `- pi: ${report.pi.detail}`,
    `- configured models: ${report.modelCount}`,
    `- default: ${report.defaultSelection || "Pi configuration default"}`,
    `- credentials: ${report.credentialProviders.length ? report.credentialProviders.join(", ") : "none detected"}`
  ];
  if (report.nextSteps.length) {
    lines.push("", "Next steps:");
    for (const step of report.nextSteps) lines.push(`- ${step}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderRun(execution, meta) {
  if (execution.rawOutput) return execution.rawOutput.endsWith("\n") ? execution.rawOutput : `${execution.rawOutput}\n`;
  return `${execution.failureMessage || `Pi ${meta.kind} completed without a final message.`}\n`;
}

export function renderStatus(jobs) {
  const lines = ["# Pi Status", ""];
  if (!jobs.length) return `${lines.join("\n")}No Pi jobs recorded in this Claude session.\n`;
  lines.push("| Job | Kind | Status | Phase | Time | Pi session | Summary | Actions |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const job of jobs) {
    const running = job.status === "running" || job.status === "queued";
    const time = duration(job.startedAt ?? job.createdAt, running ? null : job.completedAt ?? job.updatedAt);
    const actions = running
      ? [`/pi:status ${job.id}`, `/pi:cancel ${job.id}`]
      : [`/pi:result ${job.id}`];
    lines.push(`| ${escapeCell(job.id)} | ${escapeCell(job.kind)} | ${escapeCell(job.status)} | ${escapeCell(job.phase)} | ${escapeCell(time)} | ${escapeCell(job.piSessionId)} | ${escapeCell(job.summary)} | ${actions.map((value) => `\`${value}\``).join("<br>")} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderJobStatus(job) {
  const running = job.status === "running" || job.status === "queued";
  const lines = [
    "# Pi Job Status", "",
    `Job: ${job.id}`,
    `Kind: ${job.kind}`,
    `Status: ${job.status}`,
    `Phase: ${job.phase ?? "unknown"}`,
    `Time: ${duration(job.startedAt ?? job.createdAt, running ? null : job.completedAt ?? job.updatedAt)}`
  ];
  if (job.piSessionId) {
    lines.push(`Pi session ID: ${job.piSessionId}`, `Resume in Pi: pi --session ${job.piSessionId}`);
  }
  if (job.progress) lines.push(`Latest progress: ${job.progress}`);
  if (job.errorMessage) lines.push("", job.errorMessage);
  if (running) lines.push("", `Cancel: /pi:cancel ${job.id}`);
  else lines.push("", `Result: /pi:result ${job.id}`);
  return `${lines.join("\n")}\n`;
}

export function renderStoredResult(job, stored) {
  const output = stored?.rendered || stored?.execution?.rawOutput || "";
  const lines = [];
  if (output) lines.push(output.trimEnd());
  else lines.push(stored?.errorMessage || job.errorMessage || "No captured Pi result was stored for this job.");
  const sessionId = stored?.piSessionId ?? job.piSessionId;
  if (sessionId) lines.push("", `Pi session ID: ${sessionId}`, `Resume in Pi: pi --session ${sessionId}`);
  return `${lines.join("\n")}\n`;
}

export function renderCancel(job) {
  return `# Pi Cancel\n\nCancelled ${job.id}.\n\nCheck \`/pi:status\` for the updated queue.\n`;
}
