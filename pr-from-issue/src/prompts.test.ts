import { describe, it, expect } from "vitest";
import { buildPlanPrompt, buildChangePrompt, buildPrBody } from "./prompts";
import type { IssueInfo } from "@gemini-actions/shared";

const baseIssue: IssueInfo = {
  number: 42,
  title: "Add dark mode",
  body: "Please add dark mode support to the app.",
  labels: ["enhancement"],
};

describe("buildPlanPrompt", () => {
  it("includes issue title and body", () => {
    const prompt = buildPlanPrompt(baseIssue, "src/app.ts\nsrc/theme.ts");
    expect(prompt).toContain("Issue #42: Add dark mode");
    expect(prompt).toContain("dark mode support");
    expect(prompt).toContain("src/app.ts");
  });

  it("handles null body", () => {
    const issue = { ...baseIssue, body: null };
    const prompt = buildPlanPrompt(issue, "");
    expect(prompt).toContain("No description provided.");
  });
});

describe("buildChangePrompt", () => {
  it("includes issue and file contents", () => {
    const prompt = buildChangePrompt(baseIssue, {
      "src/app.ts": "const theme = 'light';",
    });
    expect(prompt).toContain("Add dark mode");
    expect(prompt).toContain("--- src/app.ts ---");
    expect(prompt).toContain("const theme = 'light'");
  });
});

describe("buildPrBody", () => {
  it("builds PR body with issue reference and file list", () => {
    const body = buildPrBody(42, [{ path: "src/app.ts" }, { path: "src/theme.ts" }]);
    expect(body).toContain("#42");
    expect(body).toContain("`src/app.ts`");
    expect(body).toContain("`src/theme.ts`");
    expect(body).toContain("Closes #42");
  });
});
