import type { GenerativeModel } from "@google/generative-ai";
import type { ActionContext } from "./action";
type Octokit = ActionContext["octokit"];
/**
 * Create a mock Octokit client for testing.
 * Returns an object with stub `rest` and `graphql` properties.
 * Pass overrides to customise specific API methods.
 */
export declare function createMockOctokit(overrides?: Record<string, unknown>): Octokit;
/**
 * Create a mock GenerativeModel for testing.
 * Responds with canned strings in sequence; cycles back to the last one if exhausted.
 */
export declare function createMockModel(responses?: string[]): GenerativeModel;
/**
 * Create a test ActionContext with sensible defaults.
 * Override any field as needed.
 */
export declare function createTestContext(overrides?: Partial<ActionContext>): ActionContext;
export {};
//# sourceMappingURL=test-utils.d.ts.map