import { truncateText } from "@gemini-actions/shared";
import type { EnrichedDependencyChange, Step1Result, Step2Result } from "./types";

export function buildStep1Prompt(enrichedDeps: EnrichedDependencyChange[]): string {
  const depSections = enrichedDeps
    .map((dep) => {
      const notes = dep.releaseNotes
        ? truncateText(dep.releaseNotes, 8000, `${dep.name} release notes`)
        : "No release notes available.";

      return `### ${dep.name} (${dep.fromVersion} → ${dep.toVersion}, ${dep.upgradeType} upgrade)\n${notes}`;
    })
    .join("\n\n");

  return `You are analyzing release notes for dependency upgrades to extract breaking changes.

For each dependency below, extract ONLY information that is explicitly stated in the release notes.

**Dependencies and their release notes:**
${depSections}

Respond with a JSON object matching this schema:
{
  "dependencies": [
    {
      "dependency": "package-name",
      "upgradeType": "major|minor|patch|unknown",
      "breakingChanges": ["list of breaking changes explicitly mentioned"],
      "deprecations": ["list of deprecations explicitly mentioned"],
      "notableChanges": ["behavioral changes, renamed APIs, new defaults"],
      "hasConfirmedBreakingChanges": true|false
    }
  ]
}

RULES:
- Only include breaking changes that are EXPLICITLY stated in the release notes (e.g., labeled "BREAKING", "Breaking Change", or in a "Migration" section).
- For major upgrades, be thorough — major versions typically contain breaking changes.
- For minor/patch upgrades, breaking changes are rare; do not fabricate them.
- If no release notes are available, set breakingChanges and deprecations to empty arrays and hasConfirmedBreakingChanges to false.
- Keep each entry concise — one sentence per breaking change.

Respond ONLY with the JSON object.`;
}

export function buildStep2Prompt(
  step1Result: Step1Result,
  usageSections: string,
): string {
  const relevantDeps = step1Result.dependencies.filter(
    (d) =>
      d.hasConfirmedBreakingChanges ||
      d.deprecations.length > 0 ||
      d.notableChanges.length > 0,
  );

  const changesSummary = relevantDeps
    .map((d) => {
      const items = [
        ...d.breakingChanges.map((c) => `  - [BREAKING] ${c}`),
        ...d.deprecations.map((c) => `  - [DEPRECATED] ${c}`),
        ...d.notableChanges.map((c) => `  - [CHANGED] ${c}`),
      ].join("\n");
      return `### ${d.dependency}\n${items}`;
    })
    .join("\n\n");

  return `You are cross-referencing dependency breaking changes with actual codebase usage.

**Breaking changes and deprecations to check:**
${changesSummary}

**Codebase usage of these dependencies:**
${usageSections}

For each breaking change or deprecation above, check whether the code patterns shown in "Codebase usage" are affected. Only report impacts that are CONFIRMED by both the change description AND the actual code shown.

Respond with a JSON object:
{
  "impacts": [
    {
      "dependency": "package-name",
      "change": "the specific breaking change",
      "affectedFiles": ["path/to/file.ts"],
      "affectedCode": ["the specific import or usage line affected"],
      "requiredAction": "what needs to change (be specific: rename X to Y, update argument from A to B, etc.)",
      "severity": "low|medium|high|critical"
    }
  ],
  "unaffectedUsages": [
    {
      "dependency": "package-name",
      "fileCount": 5
    }
  ]
}

RULES:
- Only report an impact if you can point to a SPECIFIC line from the usage context that is affected.
- If a dependency has usage in the codebase but none of its breaking changes affect the actual code shown, put it in unaffectedUsages.
- severity: critical = will break at runtime, high = likely to break, medium = may cause issues, low = cosmetic or deprecated but still functional.
- Do NOT speculate about usage patterns not shown in the codebase usage context.

Respond ONLY with the JSON object.`;
}

export function buildStep3Prompt(
  enrichedDeps: EnrichedDependencyChange[],
  step1Result: Step1Result,
  step2Result: Step2Result,
): string {
  const depList = enrichedDeps
    .map(
      (d) =>
        `- ${d.name}: ${d.fromVersion} → ${d.toVersion} (${d.upgradeType})`,
    )
    .join("\n");

  const step1Summary = truncateText(
    JSON.stringify(step1Result.dependencies, null, 2),
    5000,
    "step 1 results",
  );

  const step2Summary = truncateText(
    JSON.stringify(step2Result, null, 2),
    5000,
    "step 2 results",
  );

  return `You are writing the final dependency impact assessment for a pull request.

**Dependencies updated:**
${depList}

**Breaking changes extracted (from release notes):**
${step1Summary}

**Codebase impact analysis:**
${step2Summary}

Produce a JSON object with this structure:
{
  "overallRisk": "low|medium|high|critical",
  "riskJustification": "one sentence explaining the overall risk",
  "dependencySummaries": [
    {
      "dependency": "name",
      "fromVersion": "x.y.z",
      "toVersion": "a.b.c",
      "upgradeType": "major|minor|patch",
      "risk": "low|medium|high|critical",
      "oneLiner": "brief impact summary for this dep"
    }
  ],
  "actionItems": [
    {
      "severity": "low|medium|high|critical",
      "dependency": "name",
      "file": "path to the impacted source file",
      "description": "what to check or do (be specific)"
    }
  ],
  "inlineAnnotations": [
    {
      "dependency": "name",
      "annotation": "one-line summary for the version-change line in the manifest file"
    }
  ],
  "narrativeSummary": "2-3 paragraph markdown narrative for the review body"
}

RULES:
- overallRisk should reflect the HIGHEST severity across all impacts. If no impacts, default to "low".
- actionItems reference impacted SOURCE files from the codebase analysis, not the dependency manifest files.
- If there are no impacts from the codebase analysis, actionItems should be empty.
- inlineAnnotations provide a brief one-line summary per dependency, suitable for a comment on the manifest file's version-change line.
- Do NOT include generic advice. Every action item must be specific and tied to a concrete finding.
- The narrativeSummary should start with the most important finding. If no breaking changes were found, say "No breaking changes detected for current usage."

Respond ONLY with the JSON object.`;
}

export function buildStep3NoUsagePrompt(
  enrichedDeps: EnrichedDependencyChange[],
  step1Result: Step1Result,
): string {
  const depList = enrichedDeps
    .map(
      (d) =>
        `- ${d.name}: ${d.fromVersion} → ${d.toVersion} (${d.upgradeType})`,
    )
    .join("\n");

  const step1Summary = truncateText(
    JSON.stringify(step1Result.dependencies, null, 2),
    5000,
    "step 1 results",
  );

  return `You are writing the final dependency impact assessment for a pull request.
No usage of these dependencies was found in source files.

**Dependencies updated:**
${depList}

**Breaking changes extracted (from release notes):**
${step1Summary}

Produce a JSON object with this structure:
{
  "overallRisk": "low|medium|high|critical",
  "riskJustification": "one sentence explaining the overall risk",
  "dependencySummaries": [
    {
      "dependency": "name",
      "fromVersion": "x.y.z",
      "toVersion": "a.b.c",
      "upgradeType": "major|minor|patch",
      "risk": "low|medium|high|critical",
      "oneLiner": "brief impact summary for this dep"
    }
  ],
  "actionItems": [],
  "inlineAnnotations": [
    {
      "dependency": "name",
      "annotation": "one-line summary for the version-change line in the manifest file"
    }
  ],
  "narrativeSummary": "1-2 paragraph markdown summary of key highlights from the release notes"
}

RULES:
- Do NOT fabricate impact analysis or reference files since no usage was found.
- actionItems must be empty since there is no codebase usage to reference.
- If no release notes are available, say "No release notes available and no usage detected — no action needed." in narrativeSummary.
- Do NOT include generic advice like "review the changelog", "test in staging", or "pin versions".

Respond ONLY with the JSON object.`;
}

/**
 * Legacy single-prompt fallback, used when structured pipeline JSON parsing fails.
 */
export function buildLegacyPrompt(
  depChangesList: string,
  prBodySection: string,
  hasUsage: boolean,
  usageSections: string,
  prDiff: string,
): string {
  if (hasUsage) {
    return `You are a dependency upgrade analyst. A pull request updates the following dependencies.
Cross-reference the release notes with actual usage sites in this codebase.

**Dependency Changes:**
${depChangesList}

${prBodySection}

**Usage in Codebase:**
${usageSections}

**PR Diff:**
\`\`\`diff
${truncateText(prDiff, 10000, "PR diff")}
\`\`\`

Respond with ONLY sections that have content. Skip empty sections entirely.
- **Breaking changes affecting this codebase**: Only mention breaking changes that are confirmed by the release notes AND affect files shown in "Usage in Codebase". Do not speculate.
- **Action required**: Specific code changes needed, referencing actual file paths and line content from the usage context.
- **Risk assessment**: Low / Medium / High with a one-line justification.

RULES:
- Do NOT include generic advice like "review the changelog", "test in staging", "run terraform init", or "pin versions".
- Do NOT fabricate examples, hypothetical scenarios, or breaking changes not confirmed by the release notes.
- If the release notes do not mention breaking changes relevant to the detected usage, say "No breaking changes detected for current usage" and give a risk assessment.`;
  }

  return `You are a dependency upgrade analyst. A pull request updates the following dependencies.
No usage of these dependencies was found in the source files.

**Dependency Changes:**
${depChangesList}

${prBodySection}

Summarize the key highlights from the release notes as a concise bulleted list (max 10 bullets).
End with a one-line risk assessment (Low / Medium / High).

RULES:
- Do NOT fabricate impact analysis, example scenarios, or migration steps.
- Do NOT reference files or APIs since no usage was found.
- Do NOT include generic advice like "review the changelog", "test in staging", or "pin versions".
- If no release notes are available, say "No release notes available and no usage detected — no action needed." and stop.`;
}
