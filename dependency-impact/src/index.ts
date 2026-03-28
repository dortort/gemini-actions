import * as core from "@actions/core";
import { runAction, getActionContext } from "@gemini-actions/shared";
import { runDependencyImpact } from "./run";
import { createRegistryResolver } from "./registry";

runAction(async () => {
  const ctx = getActionContext();
  const prNumber = parseInt(core.getInput("pr_number", { required: true }), 10);

  core.info(`Analyzing dependency impact for PR #${prNumber}...`);

  await runDependencyImpact(ctx, { prNumber }, createRegistryResolver());

  core.info("Dependency impact analysis complete");
});
