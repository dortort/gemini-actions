export interface RecentCommit {
  sha: string;
  message: string;
  date: string | undefined;
  author: string | undefined;
}

export function buildAnalysisPrompt(
  datadogData: string,
  isMonitorId: boolean,
  recentCommits: RecentCommit[],
  owner: string,
  repo: string,
  action: string,
): string {
  return `You are a site reliability engineer analyzing monitoring data from Datadog in the context of a GitHub repository.

**Datadog ${isMonitorId ? "Monitor" : "Metrics"} Data:**
\`\`\`json
${datadogData}
\`\`\`

**Recent Commits (last 10):**
${recentCommits.map((c) => `- ${c.sha} (${c.date}): ${c.message} — ${c.author}`).join("\n")}

**Repository:** ${owner}/${repo}

Analyze the monitoring data and provide:
1. **Status Summary**: What is the current state? Is there an active incident or anomaly?
2. **Correlation**: Do any recent commits correlate with the observed behavior? Which ones and why?
3. **Severity Assessment**: How severe is this? (Critical / High / Medium / Low / Informational)
4. **Recommended Action**: What should be done next?

Format your response as structured markdown suitable for a GitHub ${action === "open_issue" ? "issue body" : "comment"}.`;
}
