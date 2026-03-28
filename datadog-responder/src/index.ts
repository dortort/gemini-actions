import * as core from "@actions/core";
import { runAction, getActionContext } from "@gemini-actions/shared";
import { createDatadogClient } from "./datadog";
import { runDatadogResponder } from "./run";

runAction(async () => {
  const ctx = getActionContext();
  const ddApiKey = core.getInput("datadog_api_key", { required: true });
  const ddAppKey = core.getInput("datadog_app_key", { required: true });
  const query = core.getInput("query", { required: true });
  const action = core.getInput("action", { required: true }) as "open_issue" | "comment_on_pr" | "trigger_workflow";

  core.info(`Querying Datadog: ${query}`);

  const ddClient = createDatadogClient(ddApiKey, ddAppKey);
  const resultId = await runDatadogResponder(ctx, { query, action }, ddClient);

  core.info(`Action completed: ${resultId}`);
  core.setOutput("result", resultId);
});
