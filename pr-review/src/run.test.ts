import { describe, it, expect, vi } from "vitest";
import { runPrReview } from "./run";
import { createTestContext, createMockOctokit, createMockModel } from "@gemini-actions/shared/testing";

describe("runPrReview", () => {
  const fakePR = {
    data: {
      number: 42,
      title: "Add login",
      body: "Adds login page",
      user: { login: "dev" },
      head: { ref: "feat", sha: "abc123" },
      base: { ref: "main", sha: "def456" },
    },
  };

  const fakeFiles = {
    data: [
      {
        filename: "src/login.ts",
        status: "added",
        additions: 20,
        deletions: 0,
        patch: "+export function login() {}",
      },
    ],
  };

  const fakeDiff = { data: "diff --git a/src/login.ts b/src/login.ts\n+export function login() {}" };

  function buildOctokit(reviewFn = vi.fn().mockResolvedValue({})) {
    return createMockOctokit({
      pulls: {
        get: vi.fn()
          .mockResolvedValueOnce(fakePR)
          .mockResolvedValueOnce(fakeDiff),
        listFiles: vi.fn().mockResolvedValue(fakeFiles),
        createReview: reviewFn,
      },
    });
  }

  it("posts a structured review when Gemini returns valid JSON", async () => {
    const geminiResponse = JSON.stringify({
      summary: "Code looks clean.",
      comments: [
        { path: "src/login.ts", line: 1, severity: "suggestion", comment: "Add error handling" },
      ],
    });
    const reviewFn = vi.fn().mockResolvedValue({});
    const ctx = createTestContext({
      octokit: buildOctokit(reviewFn),
      model: createMockModel([geminiResponse]),
    });

    await runPrReview(ctx, { prNumber: 42, strictness: "medium" });

    expect(reviewFn).toHaveBeenCalledOnce();
    const call = reviewFn.mock.calls[0][0];
    expect(call.body).toContain("Gemini Code Review");
    expect(call.body).toContain("medium strictness");
    expect(call.comments).toHaveLength(1);
    expect(call.comments[0].body).toContain("[SUGGESTION]");
  });

  it("posts raw response when Gemini returns non-JSON", async () => {
    const reviewFn = vi.fn().mockResolvedValue({});
    const ctx = createTestContext({
      octokit: buildOctokit(reviewFn),
      model: createMockModel(["This is not JSON, just a plain review."]),
    });

    await runPrReview(ctx, { prNumber: 42, strictness: "high" });

    expect(reviewFn).toHaveBeenCalledOnce();
    const call = reviewFn.mock.calls[0][0];
    expect(call.body).toContain("This is not JSON");
  });

  it("throws on invalid strictness", async () => {
    const ctx = createTestContext();
    await expect(
      runPrReview(ctx, { prNumber: 1, strictness: "extreme" }),
    ).rejects.toThrow("Invalid review_strictness");
  });
});
