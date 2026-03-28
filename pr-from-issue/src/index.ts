import * as core from "@actions/core";
import { runAction, getActionContext } from "@gemini-actions/shared";
import { runPrFromIssue } from "./run";

runAction(async () => {
  const ctx = getActionContext();
  const issueNumber = parseInt(core.getInput("issue_number", { required: true }), 10);

  core.info(`Processing issue #${issueNumber}...`);

  const result = await runPrFromIssue(ctx, { issueNumber });

  if (result) {
    core.info(`Created PR #${result.prNumber}`);
    core.setOutput("pr_number", result.prNumber.toString());
  } else {
    core.info("Gemini determined no changes are needed");
  }
});
