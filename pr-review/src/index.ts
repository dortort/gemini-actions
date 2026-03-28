import * as core from "@actions/core";
import { runAction, getActionContext } from "@gemini-actions/shared";
import { runPrReview } from "./run";

runAction(async () => {
  const ctx = getActionContext();
  const inputs = {
    prNumber: parseInt(core.getInput("pr_number", { required: true }), 10),
    strictness: core.getInput("review_strictness") || "medium",
  };
  await runPrReview(ctx, inputs);
});
