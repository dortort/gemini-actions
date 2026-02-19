import * as core from "@actions/core";
import { GenerativeModel } from "@google/generative-ai";
import { createGeminiModel } from "./gemini";
import { getOctokitClient, getRepoContext } from "./github";

type Octokit = ReturnType<typeof getOctokitClient>;

export interface ActionContext {
  octokit: Octokit;
  owner: string;
  repo: string;
  model: GenerativeModel;
}

/**
 * Read the standard action inputs (gemini_api_key, github_token, model)
 * and return an initialised ActionContext.
 */
export function getActionContext(): ActionContext {
  const geminiApiKey = core.getInput("gemini_api_key", { required: true });
  const githubToken = core.getInput("github_token", { required: true });
  const modelName = core.getInput("model") || "gemini-2.0-flash";

  const octokit = getOctokitClient(githubToken);
  const { owner, repo } = getRepoContext();
  const model = createGeminiModel(geminiApiKey, modelName);

  return { octokit, owner, repo, model };
}

/**
 * Wrap an action's main logic with consistent error handling.
 * Catches errors and calls `core.setFailed` so every action doesn't have to.
 */
export async function runAction(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}
