import * as core from "@actions/core";
import * as https from "https";
import {
  createGeminiModel,
  generateContent,
  getOctokitClient,
  getRepoContext,
  postComment,
} from "@gemini-actions/shared";

type ActionType = "open_issue" | "comment_on_pr" | "trigger_workflow";

interface DatadogMetricResult {
  status: string;
  query: string;
  series: Array<{
    metric: string;
    pointlist: Array<[number, number]>;
    tag_set?: string[];
  }>;
}

interface DatadogMonitorResult {
  id: number;
  name: string;
  type: string;
  overall_state: string;
  message: string;
  query: string;
}

async function datadogRequest(
  apiKey: string,
  appKey: string,
  endpoint: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`https://api.datadoghq.com${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "DD-API-KEY": apiKey,
          "DD-APPLICATION-KEY": appKey,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Failed to parse Datadog response: ${body.slice(0, 500)}`));
          }
        });
      },
    );
    req.on("error", reject);
  });
}

async function queryMetrics(
  apiKey: string,
  appKey: string,
  query: string,
): Promise<DatadogMetricResult> {
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;

  return (await datadogRequest(apiKey, appKey, "/api/v1/query", {
    from: oneHourAgo.toString(),
    to: now.toString(),
    query,
  })) as DatadogMetricResult;
}

async function getMonitor(
  apiKey: string,
  appKey: string,
  monitorId: string,
): Promise<DatadogMonitorResult> {
  return (await datadogRequest(
    apiKey,
    appKey,
    `/api/v1/monitor/${monitorId}`,
  )) as DatadogMonitorResult;
}

async function run(): Promise<void> {
  try {
    const ddApiKey = core.getInput("datadog_api_key", { required: true });
    const ddAppKey = core.getInput("datadog_app_key", { required: true });
    const query = core.getInput("query", { required: true });
    const action = core.getInput("action", { required: true }) as ActionType;
    const geminiApiKey = core.getInput("gemini_api_key", { required: true });
    const githubToken = core.getInput("github_token", { required: true });
    const modelName = core.getInput("model") || "gemini-2.0-flash";

    const validActions: ActionType[] = [
      "open_issue",
      "comment_on_pr",
      "trigger_workflow",
    ];
    if (!validActions.includes(action)) {
      throw new Error(
        `Invalid action: ${action}. Must be one of: ${validActions.join(", ")}`,
      );
    }

    const octokit = getOctokitClient(githubToken);
    const { owner, repo } = getRepoContext();
    const model = createGeminiModel(geminiApiKey, modelName);

    core.info(`Querying Datadog: ${query}`);

    // 1. Query Datadog - determine if it's a monitor ID or a metrics query
    let datadogData: string;
    const isMonitorId = /^\d+$/.test(query.trim());

    if (isMonitorId) {
      const monitor = await getMonitor(ddApiKey, ddAppKey, query.trim());
      datadogData = JSON.stringify(monitor, null, 2);
      core.info(`Monitor "${monitor.name}" state: ${monitor.overall_state}`);
    } else {
      const metrics = await queryMetrics(ddApiKey, ddAppKey, query);
      datadogData = JSON.stringify(metrics, null, 2);
      core.info(`Metrics query returned ${metrics.series?.length ?? 0} series`);
    }

    // 2. Get recent commits for correlation
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 10,
    });

    const recentCommits = commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0],
      date: c.commit.author?.date,
      author: c.commit.author?.name,
    }));

    // 3. Ask Gemini to interpret the data
    const prompt = `You are a site reliability engineer analyzing monitoring data from Datadog in the context of a GitHub repository.

**Datadog ${isMonitorId ? "Monitor" : "Metrics"} Data:**
\`\`\`json
${datadogData.slice(0, 10000)}
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

    const analysis = await generateContent(model, prompt);

    // 4. Take the specified action
    let resultId: string;

    switch (action) {
      case "open_issue": {
        const { data: issue } = await octokit.rest.issues.create({
          owner,
          repo,
          title: `[Datadog Alert] ${isMonitorId ? `Monitor ${query}` : "Metrics anomaly detected"}`,
          body: `## Datadog Alert Analysis\n\n${analysis}\n\n---\n*Generated by [gemini-datadog-responder](https://github.com/dortort/gemini-actions)*`,
          labels: ["datadog", "automated"],
        });
        resultId = issue.number.toString();
        core.info(`Created issue #${resultId}`);
        break;
      }

      case "comment_on_pr": {
        // Find the most recent open PR
        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: "open",
          sort: "updated",
          direction: "desc",
          per_page: 1,
        });

        if (prs.length === 0) {
          throw new Error("No open pull requests found to comment on");
        }

        const prNumber = prs[0].number;
        await postComment(
          octokit,
          owner,
          repo,
          prNumber,
          `## Datadog Alert Analysis\n\n${analysis}\n\n---\n*Generated by [gemini-datadog-responder](https://github.com/dortort/gemini-actions)*`,
        );
        resultId = prNumber.toString();
        core.info(`Commented on PR #${resultId}`);
        break;
      }

      case "trigger_workflow": {
        // Trigger the repository_dispatch event so users can listen for it
        await octokit.rest.repos.createDispatchEvent({
          owner,
          repo,
          event_type: "datadog-alert",
          client_payload: {
            query,
            analysis,
            is_monitor: isMonitorId,
          },
        });
        resultId = "dispatch-sent";
        core.info("Triggered repository_dispatch event: datadog-alert");
        break;
      }
    }

    core.setOutput("result", resultId);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
