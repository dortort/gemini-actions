import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt } from "./prompts";

describe("buildAnalysisPrompt", () => {
  const commits = [
    { sha: "abc1234", message: "feat: add login", date: "2024-01-01T00:00:00Z", author: "dev" },
  ];

  it("includes monitor label when isMonitorId is true", () => {
    const prompt = buildAnalysisPrompt("{}", true, commits, "owner", "repo", "open_issue");
    expect(prompt).toContain("Datadog Monitor Data:");
  });

  it("includes metrics label when isMonitorId is false", () => {
    const prompt = buildAnalysisPrompt("{}", false, commits, "owner", "repo", "comment_on_pr");
    expect(prompt).toContain("Datadog Metrics Data:");
  });

  it("includes recent commits", () => {
    const prompt = buildAnalysisPrompt("{}", true, commits, "owner", "repo", "open_issue");
    expect(prompt).toContain("abc1234");
    expect(prompt).toContain("feat: add login");
  });

  it("uses issue body phrasing for open_issue action", () => {
    const prompt = buildAnalysisPrompt("{}", true, commits, "owner", "repo", "open_issue");
    expect(prompt).toContain("issue body");
  });

  it("uses comment phrasing for comment_on_pr action", () => {
    const prompt = buildAnalysisPrompt("{}", true, commits, "owner", "repo", "comment_on_pr");
    expect(prompt).toContain("GitHub comment");
  });
});
