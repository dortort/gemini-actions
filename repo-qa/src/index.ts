import * as core from "@actions/core";
import { runAction, getActionContext } from "@gemini-actions/shared";
import { runRepoQA } from "./run";

runAction(async () => {
  const ctx = getActionContext();
  const issueNumberStr = core.getInput("issue_number");
  const discussionIdStr = core.getInput("discussion_id");
  const sourcePaths = core.getInput("source_paths") || "src/**";

  await runRepoQA(ctx, {
    issueNumber: issueNumberStr ? parseInt(issueNumberStr, 10) : undefined,
    discussionId: discussionIdStr || undefined,
    sourcePaths,
  });
});
