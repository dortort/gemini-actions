import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { runAction, getActionContext } from "@gemini-actions/shared";
import { runTestFailureDiagnosis } from "./run";

runAction(async () => {
  const ctx = getActionContext();
  const prNumber = parseInt(core.getInput("pr_number", { required: true }), 10);
  const testOutputPath = core.getInput("test_output", { required: true });

  // Read the test output file — fs stays in the thin shell, not in the testable run function
  let testOutput: string;
  const resolvedPath = path.resolve(testOutputPath);

  if (fs.existsSync(resolvedPath)) {
    testOutput = fs.readFileSync(resolvedPath, "utf-8");
    core.info(`Read test output from ${resolvedPath} (${testOutput.length} chars)`);
  } else {
    const workspacePath = path.join(
      process.env.GITHUB_WORKSPACE || ".",
      testOutputPath,
    );
    if (fs.existsSync(workspacePath)) {
      testOutput = fs.readFileSync(workspacePath, "utf-8");
      core.info(`Read test output from ${workspacePath}`);
    } else {
      throw new Error(
        `Test output not found at ${resolvedPath} or ${workspacePath}`,
      );
    }
  }

  await runTestFailureDiagnosis(ctx, { prNumber, testOutput });
});
