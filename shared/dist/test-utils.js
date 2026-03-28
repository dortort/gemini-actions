"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockOctokit = createMockOctokit;
exports.createMockModel = createMockModel;
exports.createTestContext = createTestContext;
/**
 * Create a mock Octokit client for testing.
 * Returns an object with stub `rest` and `graphql` properties.
 * Pass overrides to customise specific API methods.
 */
function createMockOctokit(overrides = {}) {
    const noop = async () => ({ data: {} });
    const handler = {
        get(_target, prop) {
            if (prop in overrides)
                return overrides[prop];
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
    };
}
/**
 * Create a mock GenerativeModel for testing.
 * Responds with canned strings in sequence; cycles back to the last one if exhausted.
 */
function createMockModel(responses = ["{}"]) {
    let index = 0;
    return {
        generateContent: async () => {
            const text = responses[Math.min(index, responses.length - 1)];
            index++;
            return { response: { text: () => text } };
        },
        countTokens: async () => ({ totalTokens: 100 }),
    };
}
/**
 * Create a test ActionContext with sensible defaults.
 * Override any field as needed.
 */
function createTestContext(overrides = {}) {
    return {
        octokit: createMockOctokit(),
        owner: "test-owner",
        repo: "test-repo",
        model: createMockModel(),
        ...overrides,
    };
}
//# sourceMappingURL=test-utils.js.map