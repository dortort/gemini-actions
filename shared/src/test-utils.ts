import type { GenerativeModel } from "@google/generative-ai";
import type { ActionContext } from "./action";

type Octokit = ActionContext["octokit"];

/**
 * Create a mock Octokit client for testing.
 * Returns an object with stub `rest` and `graphql` properties.
 * Pass overrides to customise specific API methods.
 */
export function createMockOctokit(
  overrides: Record<string, unknown> = {},
): Octokit {
  const noop = async () => ({ data: {} });

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop in overrides) return overrides[prop as string];
      // Return a proxy that returns noop for any nested property access
      return new Proxy({}, {
        get() {
          return noop;
        },
      });
    },
  };

  return {
    rest: new Proxy({}, handler),
    graphql: overrides.graphql ?? noop,
  } as unknown as Octokit;
}

/**
 * Create a mock GenerativeModel for testing.
 * Responds with canned strings in sequence; cycles back to the last one if exhausted.
 */
export function createMockModel(responses: string[] = ["{}"]): GenerativeModel {
  let index = 0;

  return {
    generateContent: async () => {
      const text = responses[Math.min(index, responses.length - 1)];
      index++;
      return { response: { text: () => text } };
    },
    countTokens: async () => ({ totalTokens: 100 }),
  } as unknown as GenerativeModel;
}

/**
 * Create a test ActionContext with sensible defaults.
 * Override any field as needed.
 */
export function createTestContext(
  overrides: Partial<ActionContext> = {},
): ActionContext {
  return {
    octokit: createMockOctokit(),
    owner: "test-owner",
    repo: "test-repo",
    model: createMockModel(),
    ...overrides,
  };
}
