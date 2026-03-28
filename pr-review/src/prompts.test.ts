import { describe, it, expect } from "vitest";
import { buildFileSections, buildReviewPrompt, STRICTNESS_PROMPTS } from "./prompts";
import type { PullRequestInfo } from "@gemini-actions/shared";

const basePR: PullRequestInfo = {
  number: 1,
  title: "Add feature",
  body: "Implements feature X",
  author: "dev",
  diff: "",
  files: [
    {
      filename: "src/index.ts",
      status: "modified",
      additions: 10,
      deletions: 2,
      patch: "+const x = 1;\n-const y = 2;",
    },
  ],
  head: { ref: "feature", sha: "abc" },
  base: { ref: "main", sha: "def" },
};

describe("STRICTNESS_PROMPTS", () => {
  it("has entries for low, medium, and high", () => {
    expect(STRICTNESS_PROMPTS).toHaveProperty("low");
    expect(STRICTNESS_PROMPTS).toHaveProperty("medium");
    expect(STRICTNESS_PROMPTS).toHaveProperty("high");
  });
});

describe("buildFileSections", () => {
  it("builds diff sections for each file", () => {
    const sections = buildFileSections(basePR);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain("src/index.ts");
    expect(sections[0]).toContain("```diff");
  });

  it("omits diff when total budget is exceeded", () => {
    const largePR: PullRequestInfo = {
      ...basePR,
      files: [
        { filename: "a.ts", status: "modified", additions: 1, deletions: 0, patch: "x".repeat(150000) },
        { filename: "b.ts", status: "modified", additions: 1, deletions: 0, patch: "y".repeat(150000) },
      ],
    };
    const sections = buildFileSections(largePR, 200000, 200000);
    // Second file should be omitted due to budget
    expect(sections[1]).toContain("Diff omitted");
  });

  it("handles files without a patch", () => {
    const pr: PullRequestInfo = {
      ...basePR,
      files: [{ filename: "binary.png", status: "added", additions: 0, deletions: 0 }],
    };
    const sections = buildFileSections(pr);
    expect(sections[0]).toContain("Binary file or no diff available");
  });
});

describe("buildReviewPrompt", () => {
  it("includes PR title, strictness, and file sections", () => {
    const prompt = buildReviewPrompt(basePR, "medium", ["### file section"]);
    expect(prompt).toContain("Add feature");
    expect(prompt).toContain("medium");
    expect(prompt).toContain(STRICTNESS_PROMPTS["medium"]);
    expect(prompt).toContain("### file section");
    expect(prompt).toContain("JSON object");
  });

  it("shows fallback when PR has no description", () => {
    const pr = { ...basePR, body: null };
    const prompt = buildReviewPrompt(pr, "low", []);
    expect(prompt).toContain("No description provided.");
  });
});
