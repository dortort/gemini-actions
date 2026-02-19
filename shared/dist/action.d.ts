import { GenerativeModel } from "@google/generative-ai";
import { getOctokitClient } from "./github";
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
export declare function getActionContext(): ActionContext;
/**
 * Wrap an action's main logic with consistent error handling.
 * Catches errors and calls `core.setFailed` so every action doesn't have to.
 */
export declare function runAction(fn: () => Promise<void>): Promise<void>;
export {};
//# sourceMappingURL=action.d.ts.map