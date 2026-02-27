import { describe, it, expect } from "vitest";
import {
  buildStep1Prompt,
  buildStep2Prompt,
  buildStep3Prompt,
  buildStep3NoUsagePrompt,
  buildLegacyPrompt,
} from "./prompts";
import type { EnrichedDependencyChange, Step1Result, Step2Result } from "./types";

const sampleDep: EnrichedDependencyChange = {
  name: "axios",
  fromVersion: "1.6.0",
  toVersion: "2.0.0",
  ecosystem: "npm",
  upgradeType: "major",
  releaseNotes: "## Breaking Changes\n- Removed `createInstance()` default export",
};

const sampleDepNoNotes: EnrichedDependencyChange = {
  name: "lodash",
  fromVersion: "4.17.20",
  toVersion: "4.17.21",
  ecosystem: "npm",
  upgradeType: "patch",
  releaseNotes: null,
};

const sampleStep1Result: Step1Result = {
  dependencies: [
    {
      dependency: "axios",
      upgradeType: "major",
      breakingChanges: ["Removed createInstance() default export"],
      deprecations: [],
      notableChanges: ["New fetch-based adapter"],
      hasConfirmedBreakingChanges: true,
    },
  ],
};

const sampleStep1NoBreaking: Step1Result = {
  dependencies: [
    {
      dependency: "lodash",
      upgradeType: "patch",
      breakingChanges: [],
      deprecations: [],
      notableChanges: [],
      hasConfirmedBreakingChanges: false,
    },
  ],
};

const sampleStep2Result: Step2Result = {
  impacts: [
    {
      dependency: "axios",
      change: "Removed createInstance() default export",
      affectedFiles: ["src/api/client.ts"],
      affectedCode: ["import axios from 'axios'"],
      requiredAction: "Use named import: import { axios } from 'axios'",
      severity: "high",
    },
  ],
  unaffectedUsages: [],
};

const emptyStep2: Step2Result = {
  impacts: [],
  unaffectedUsages: [],
};

describe("buildStep1Prompt", () => {
  it("includes dependency name and version info", () => {
    const prompt = buildStep1Prompt([sampleDep]);
    expect(prompt).toContain("axios");
    expect(prompt).toContain("1.6.0");
    expect(prompt).toContain("2.0.0");
    expect(prompt).toContain("major upgrade");
  });

  it("includes release notes when available", () => {
    const prompt = buildStep1Prompt([sampleDep]);
    expect(prompt).toContain("Removed `createInstance()` default export");
  });

  it("indicates when release notes are unavailable", () => {
    const prompt = buildStep1Prompt([sampleDepNoNotes]);
    expect(prompt).toContain("No release notes available.");
  });

  it("includes multiple dependencies", () => {
    const prompt = buildStep1Prompt([sampleDep, sampleDepNoNotes]);
    expect(prompt).toContain("axios");
    expect(prompt).toContain("lodash");
  });

  it("requests JSON output", () => {
    const prompt = buildStep1Prompt([sampleDep]);
    expect(prompt).toContain('"dependencies"');
    expect(prompt).toContain("Respond ONLY with the JSON object");
  });

  it("includes rules about not fabricating breaking changes", () => {
    const prompt = buildStep1Prompt([sampleDep]);
    expect(prompt).toContain("EXPLICITLY stated");
  });
});

describe("buildStep2Prompt", () => {
  it("includes breaking changes from step 1", () => {
    const prompt = buildStep2Prompt(sampleStep1Result, "### axios\nimport axios from 'axios'");
    expect(prompt).toContain("[BREAKING] Removed createInstance() default export");
  });

  it("includes notable changes from step 1", () => {
    const prompt = buildStep2Prompt(sampleStep1Result, "### axios\nimport axios");
    expect(prompt).toContain("[CHANGED] New fetch-based adapter");
  });

  it("filters out dependencies with no changes from the changes section", () => {
    const prompt = buildStep2Prompt(sampleStep1NoBreaking, "### lodash\nimport lodash");
    // The breaking changes section should be empty since lodash has no breaking/deprecation/notable changes
    expect(prompt).toContain("**Breaking changes and deprecations to check:**\n\n\n**Codebase usage");
  });

  it("includes usage sections", () => {
    const usage = "### axios\n**src/api/client.ts:**\nimport axios from 'axios'";
    const prompt = buildStep2Prompt(sampleStep1Result, usage);
    expect(prompt).toContain("src/api/client.ts");
  });

  it("requests JSON output with impacts schema", () => {
    const prompt = buildStep2Prompt(sampleStep1Result, "usage");
    expect(prompt).toContain('"impacts"');
    expect(prompt).toContain('"unaffectedUsages"');
    expect(prompt).toContain("Respond ONLY with the JSON object");
  });
});

describe("buildStep3Prompt", () => {
  it("includes dependency list", () => {
    const prompt = buildStep3Prompt([sampleDep], sampleStep1Result, sampleStep2Result);
    expect(prompt).toContain("axios: 1.6.0");
    expect(prompt).toContain("2.0.0");
  });

  it("includes step 1 and step 2 results", () => {
    const prompt = buildStep3Prompt([sampleDep], sampleStep1Result, sampleStep2Result);
    expect(prompt).toContain("Breaking changes extracted");
    expect(prompt).toContain("Codebase impact analysis");
  });

  it("requests the full assessment schema", () => {
    const prompt = buildStep3Prompt([sampleDep], sampleStep1Result, emptyStep2);
    expect(prompt).toContain('"overallRisk"');
    expect(prompt).toContain('"dependencySummaries"');
    expect(prompt).toContain('"actionItems"');
    expect(prompt).toContain('"inlineAnnotations"');
    expect(prompt).toContain('"narrativeSummary"');
  });
});

describe("buildStep3NoUsagePrompt", () => {
  it("states no usage was found", () => {
    const prompt = buildStep3NoUsagePrompt([sampleDep], sampleStep1Result);
    expect(prompt).toContain("No usage of these dependencies was found");
  });

  it("requires empty actionItems", () => {
    const prompt = buildStep3NoUsagePrompt([sampleDep], sampleStep1Result);
    expect(prompt).toContain('"actionItems": []');
  });

  it("includes dependency list and step 1 results", () => {
    const prompt = buildStep3NoUsagePrompt([sampleDep], sampleStep1Result);
    expect(prompt).toContain("axios");
    expect(prompt).toContain("Breaking changes extracted");
  });
});

describe("buildLegacyPrompt", () => {
  const depList = "- **axios**: 1.6.0 → 2.0.0 (npm)";
  const prBody = "**Release Notes:**\nSome notes";

  it("includes usage sections when hasUsage is true", () => {
    const prompt = buildLegacyPrompt(depList, prBody, true, "### axios\nimport axios", "diff content");
    expect(prompt).toContain("Usage in Codebase");
    expect(prompt).toContain("import axios");
    expect(prompt).toContain("PR Diff");
  });

  it("does not include usage when hasUsage is false", () => {
    const prompt = buildLegacyPrompt(depList, prBody, false, "", "");
    expect(prompt).toContain("No usage of these dependencies was found");
    expect(prompt).not.toContain("Usage in Codebase");
  });

  it("includes dependency changes list in both modes", () => {
    const withUsage = buildLegacyPrompt(depList, prBody, true, "usage", "diff");
    const noUsage = buildLegacyPrompt(depList, prBody, false, "", "");
    expect(withUsage).toContain("axios");
    expect(noUsage).toContain("axios");
  });

  it("includes release notes in both modes", () => {
    const withUsage = buildLegacyPrompt(depList, prBody, true, "usage", "diff");
    const noUsage = buildLegacyPrompt(depList, prBody, false, "", "");
    expect(withUsage).toContain("Some notes");
    expect(noUsage).toContain("Some notes");
  });
});
