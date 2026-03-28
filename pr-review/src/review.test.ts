import { describe, it, expect } from "vitest";
import { filterValidComments, buildSummaryBody } from "./review";
import type { GeminiReview, GeminiReviewComment } from "./review";
import type { PullRequestInfo } from "@gemini-actions/shared";

const basePR: PullRequestInfo = {
  number: 1,
  title: "Test PR",
  body: null,
  author: "dev",
  diff: "",
  files: [
    { filename: "src/a.ts", status: "modified", additions: 5, deletions: 1 },
    { filename: "src/b.ts", status: "added", additions: 10, deletions: 0 },
  ],
  head: { ref: "feat", sha: "abc" },
  base: { ref: "main", sha: "def" },
};

describe("filterValidComments", () => {
  it("keeps comments for files in the PR with positive line numbers", () => {
    const comments: GeminiReviewComment[] = [
      { path: "src/a.ts", line: 5, severity: "warning", comment: "Fix this" },
    ];
    const result = filterValidComments(comments, basePR);
    expect(result).toHaveLength(1);
    expect(result[0].body).toContain("[WARNING]");
    expect(result[0].body).toContain("Fix this");
  });

  it("filters out comments for files not in the PR", () => {
    const comments: GeminiReviewComment[] = [
      { path: "src/unknown.ts", line: 1, severity: "critical", comment: "Oops" },
    ];
    const result = filterValidComments(comments, basePR);
    expect(result).toHaveLength(0);
  });

  it("filters out comments with line <= 0", () => {
    const comments: GeminiReviewComment[] = [
      { path: "src/a.ts", line: 0, severity: "suggestion", comment: "Bad line" },
      { path: "src/a.ts", line: -1, severity: "suggestion", comment: "Negative" },
    ];
    const result = filterValidComments(comments, basePR);
    expect(result).toHaveLength(0);
  });

  it("maps severity to the correct prefix", () => {
    const comments: GeminiReviewComment[] = [
      { path: "src/a.ts", line: 1, severity: "critical", comment: "c" },
      { path: "src/a.ts", line: 2, severity: "nitpick", comment: "n" },
    ];
    const result = filterValidComments(comments, basePR);
    expect(result[0].body).toContain("[CRITICAL]");
    expect(result[1].body).toContain("[NITPICK]");
  });
});

describe("buildSummaryBody", () => {
  it("includes strictness and comment counts", () => {
    const review: GeminiReview = {
      summary: "Looks good overall.",
      comments: [
        { path: "src/a.ts", line: 1, severity: "warning", comment: "Check this" },
        { path: "src/b.ts", line: 5, severity: "suggestion", comment: "Consider" },
      ],
    };
    const body = buildSummaryBody(review, "medium");
    expect(body).toContain("medium strictness");
    expect(body).toContain("Looks good overall.");
    expect(body).toContain("2 comment(s)");
    expect(body).toContain("2 file(s)");
  });
});
