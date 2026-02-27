import { describe, it, expect } from "vitest";
import { buildReviewBody, buildInlineComments } from "./review";
import type { DependencyAssessment, EnrichedDependencyChange } from "./types";
import type { PullRequestFile } from "@gemini-actions/shared";

const baseAssessment: DependencyAssessment = {
  overallRisk: "high",
  riskJustification: "Major upgrade with confirmed breaking change",
  dependencySummaries: [
    {
      dependency: "axios",
      fromVersion: "1.6.0",
      toVersion: "2.0.0",
      upgradeType: "major",
      risk: "high",
      oneLiner: "Breaking: createInstance removed",
    },
  ],
  actionItems: [
    {
      severity: "high",
      dependency: "axios",
      file: "src/api/client.ts",
      description: "Replace createInstance() with new Axios()",
    },
  ],
  inlineAnnotations: [
    {
      dependency: "axios",
      annotation: "**Major upgrade** — createInstance() removed, see review for details",
    },
  ],
  narrativeSummary: "The axios 2.0 upgrade removes the createInstance() export.",
};

const lowRiskAssessment: DependencyAssessment = {
  overallRisk: "low",
  riskJustification: "Patch upgrade with no breaking changes",
  dependencySummaries: [
    {
      dependency: "lodash",
      fromVersion: "4.17.20",
      toVersion: "4.17.21",
      upgradeType: "patch",
      risk: "low",
      oneLiner: "Security fix only",
    },
  ],
  actionItems: [],
  inlineAnnotations: [
    {
      dependency: "lodash",
      annotation: "Patch — security fix, no breaking changes",
    },
  ],
  narrativeSummary: "No breaking changes detected for current usage.",
};

describe("buildReviewBody", () => {
  it("includes the risk badge", () => {
    const body = buildReviewBody(baseAssessment);
    expect(body).toContain("**HIGH RISK**");
    expect(body).toContain("Major upgrade with confirmed breaking change");
  });

  it("includes the summary table", () => {
    const body = buildReviewBody(baseAssessment);
    expect(body).toContain("| Dependency | Version | Type | Risk | Summary |");
    expect(body).toContain("| axios |");
    expect(body).toContain("1.6.0 → 2.0.0");
    expect(body).toContain("major");
    expect(body).toContain("Breaking: createInstance removed");
  });

  it("includes action items when present", () => {
    const body = buildReviewBody(baseAssessment);
    expect(body).toContain("### Action Required");
    expect(body).toContain("`src/api/client.ts`");
    expect(body).toContain("Replace createInstance() with new Axios()");
  });

  it("omits action section when no action items", () => {
    const body = buildReviewBody(lowRiskAssessment);
    expect(body).not.toContain("### Action Required");
  });

  it("includes narrative summary", () => {
    const body = buildReviewBody(baseAssessment);
    expect(body).toContain("createInstance() export");
  });

  it("includes footer with dependency count", () => {
    const body = buildReviewBody(baseAssessment);
    expect(body).toContain("1 dependency change(s) analyzed");
  });

  it("renders low risk correctly", () => {
    const body = buildReviewBody(lowRiskAssessment);
    expect(body).toContain("**LOW RISK**");
  });
});

describe("buildInlineComments", () => {
  const enrichedDeps: EnrichedDependencyChange[] = [
    {
      name: "axios",
      fromVersion: "1.6.0",
      toVersion: "2.0.0",
      ecosystem: "npm",
      upgradeType: "major",
      releaseNotes: null,
    },
    {
      name: "lodash",
      fromVersion: "4.17.20",
      toVersion: "4.17.21",
      ecosystem: "npm",
      upgradeType: "patch",
      releaseNotes: null,
    },
  ];

  const prFiles: PullRequestFile[] = [
    {
      filename: "package.json",
      status: "modified",
      additions: 2,
      deletions: 2,
      patch: [
        `@@ -10,4 +10,4 @@`,
        `     "lodash": "^4.17.20",`,
        `-    "axios": "^1.6.0"`,
        `+    "axios": "^2.0.0"`,
      ].join("\n"),
    },
  ];

  it("maps annotations to the correct file and line", () => {
    const comments = buildInlineComments(baseAssessment, enrichedDeps, prFiles);
    expect(comments).toHaveLength(1);
    expect(comments[0].path).toBe("package.json");
    expect(comments[0].line).toBe(11);
    expect(comments[0].body).toContain("Major upgrade");
  });

  it("skips annotations for dependencies not in enrichedDeps", () => {
    const assessment: DependencyAssessment = {
      ...baseAssessment,
      inlineAnnotations: [
        { dependency: "nonexistent-package", annotation: "Should be skipped" },
      ],
    };
    const comments = buildInlineComments(assessment, enrichedDeps, prFiles);
    expect(comments).toHaveLength(0);
  });

  it("skips annotations when dependency is not in any PR file patch", () => {
    const emptyFiles: PullRequestFile[] = [
      {
        filename: "package.json",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: [
          `@@ -1,3 +1,3 @@`,
          `-  "name": "old"`,
          `+  "name": "new"`,
        ].join("\n"),
      },
    ];
    const comments = buildInlineComments(baseAssessment, enrichedDeps, emptyFiles);
    expect(comments).toHaveLength(0);
  });

  it("handles files without patches", () => {
    const filesNoPatch: PullRequestFile[] = [
      { filename: "package.json", status: "modified", additions: 0, deletions: 0 },
    ];
    const comments = buildInlineComments(baseAssessment, enrichedDeps, filesNoPatch);
    expect(comments).toHaveLength(0);
  });

  it("returns empty array when there are no annotations", () => {
    const noAnnotations: DependencyAssessment = {
      ...baseAssessment,
      inlineAnnotations: [],
    };
    const comments = buildInlineComments(noAnnotations, enrichedDeps, prFiles);
    expect(comments).toHaveLength(0);
  });

  it("produces one comment per dependency even with multiple files", () => {
    const multiFiles: PullRequestFile[] = [
      {
        filename: "package.json",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: `@@ -10,3 +10,3 @@\n-    "axios": "^1.6.0"\n+    "axios": "^2.0.0"`,
      },
      {
        filename: "package-lock.json",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: `@@ -100,3 +100,3 @@\n-    "axios": "1.6.0"\n+    "axios": "2.0.0"`,
      },
    ];
    const comments = buildInlineComments(baseAssessment, enrichedDeps, multiFiles);
    // Should only match the first file
    expect(comments).toHaveLength(1);
    expect(comments[0].path).toBe("package.json");
  });
});
