import {
  generateContent,
  truncateText,
  parseJsonResponse,
  getPullRequest,
  getFileContent,
  postComment,
  createReview,
  getDefaultBranch,
  getRepoTree,
  listReleaseNotesBetween,
  ActionContext,
} from "@gemini-actions/shared";
import { parseDependencyChanges, getImportPatterns, classifyUpgrade, extractDependabotSection } from "./parsers";
import type {
  EnrichedDependencyChange,
  Step1Result,
  Step2Result,
  DependencyAssessment,
} from "./types";
import {
  buildStep1Prompt,
  buildStep2Prompt,
  buildStep3Prompt,
  buildStep3NoUsagePrompt,
  buildLegacyPrompt,
} from "./prompts";
import { buildReviewBody, buildInlineComments } from "./review";
import type { RegistryResolver } from "./registry";

export interface DependencyImpactInputs {
  prNumber: number;
}

export async function runDependencyImpact(
  ctx: ActionContext,
  inputs: DependencyImpactInputs,
  resolveGitHubRepo: RegistryResolver,
): Promise<void> {
  const { octokit, owner, repo, model } = ctx;
  const { prNumber } = inputs;

  // 1. Get PR details
  const pr = await getPullRequest(octokit, owner, repo, prNumber);

  // 2. Parse dependency changes, deduplicating
  const depChanges = (() => {
    const seen = new Set<string>();
    return parseDependencyChanges(pr.diff, pr.files).filter((dep) => {
      const key = `${dep.name}::${dep.ecosystem}::${dep.fromVersion}::${dep.toVersion}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  if (depChanges.length === 0) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      "## Gemini Dependency Impact Analysis\n\nNo dependency version changes detected in this PR.",
    );
    return;
  }

  // 3. Get repository file tree to find usage
  const defaultBranch = await getDefaultBranch(octokit, owner, repo);
  const tree = await getRepoTree(octokit, owner, repo, defaultBranch.sha);
  const sourceFiles = tree
    .filter((item) => item.type === "blob")
    .filter((item) => /\.(ts|js|tsx|jsx|py|go|java|rb|rs|tf|php)$/.test(item.path))
    .filter((item) => !item.path.includes("node_modules"))
    .map((item) => item.path);

  // 4. Sample source files to find usage of changed dependencies
  const usageContext: Record<string, string[]> = {};

  for (const dep of depChanges) {
    usageContext[dep.name] = [];
    const importPatterns = getImportPatterns(dep.name, dep.ecosystem);

    for (const filePath of sourceFiles.slice(0, 100)) {
      try {
        const content = await getFileContent(
          octokit,
          owner,
          repo,
          filePath,
          defaultBranch.name,
        );

        if (importPatterns.some((pattern) => content.includes(pattern))) {
          const relevantLines = content
            .split("\n")
            .filter((line) =>
              importPatterns.some((p) => line.includes(p)) ||
              line.includes(dep.name),
            )
            .slice(0, 20);

          if (relevantLines.length > 0) {
            usageContext[dep.name].push(
              `**${filePath}:**\n${relevantLines.join("\n")}`,
            );
          }
        }
      } catch {
        // Skip files we can't read
      }
    }
  }

  // 5. Fetch release notes
  const isDependabot = /\[bot\]$/.test(pr.author);
  const hasBody = pr.body != null && pr.body.trim().length > 50;
  const releaseNotesPerDep = new Map<string, string>();
  const depNoteKey = (d: { name: string; ecosystem: string; fromVersion: string; toVersion: string }) =>
    `${d.name}::${d.ecosystem}::${d.fromVersion}::${d.toVersion}`;

  if (isDependabot && hasBody) {
    for (const dep of depChanges) {
      releaseNotesPerDep.set(depNoteKey(dep), extractDependabotSection(pr.body!, dep.name));
    }
  } else {
    for (const dep of depChanges) {
      const ghRepo = await resolveGitHubRepo(dep);
      if (ghRepo) {
        const notes = await listReleaseNotesBetween(
          octokit,
          ghRepo.owner,
          ghRepo.repo,
          dep.fromVersion,
          dep.toVersion,
        );
        if (notes) {
          releaseNotesPerDep.set(depNoteKey(dep), notes);
        }
      }
    }
    if (releaseNotesPerDep.size === 0 && hasBody) {
      for (const dep of depChanges) {
        releaseNotesPerDep.set(depNoteKey(dep), pr.body!);
      }
    }
  }

  // 6. Enrich dependency changes
  const enrichedDeps: EnrichedDependencyChange[] = depChanges.map((dep) => ({
    ...dep,
    upgradeType: classifyUpgrade(dep.fromVersion, dep.toVersion),
    releaseNotes: releaseNotesPerDep.get(depNoteKey(dep)) ?? null,
  }));

  const maxUsageCharsPerDep = 5000;
  const usageSections = Object.entries(usageContext)
    .map(([name, usages]) => {
      if (usages.length === 0) return `### ${name}\nNo direct imports found in source files.`;
      const joined = usages.join("\n\n");
      return `### ${name}\n${truncateText(joined, maxUsageCharsPerDep, `${name} usage`)}`;
    })
    .join("\n\n");

  const hasUsage = Object.values(usageContext).some((usages) => usages.length > 0);

  // 7. Step 1: Extract breaking changes
  let step1Result: Step1Result;
  try {
    const step1Response = await generateContent(model, buildStep1Prompt(enrichedDeps), 200_000);
    step1Result = parseJsonResponse<Step1Result>(step1Response);
  } catch {
    await runLegacyFallback(enrichedDeps, usageSections, hasUsage, pr.diff);
    return;
  }

  // 8. Step 2: Cross-reference with codebase usage (conditional)
  const hasBreakingChanges = step1Result.dependencies.some(
    (d) =>
      d.hasConfirmedBreakingChanges ||
      (d.deprecations?.length ?? 0) > 0 ||
      (d.notableChanges?.length ?? 0) > 0,
  );

  let step2Result: Step2Result = { impacts: [], unaffectedUsages: [] };

  if (hasUsage && hasBreakingChanges) {
    try {
      const step2Response = await generateContent(model, buildStep2Prompt(step1Result, usageSections), 300_000);
      const parsed = parseJsonResponse<Step2Result>(step2Response);
      step2Result = parsed;
    } catch {
      // Proceed with empty impact analysis
    }
  }

  // 9. Step 3: Synthesize final assessment
  let assessment: DependencyAssessment;
  try {
    const step3Prompt = hasUsage
      ? buildStep3Prompt(enrichedDeps, step1Result, step2Result)
      : buildStep3NoUsagePrompt(enrichedDeps, step1Result);

    const step3Response = await generateContent(model, step3Prompt, 100_000);
    assessment = parseJsonResponse<DependencyAssessment>(step3Response);
  } catch {
    await runLegacyFallback(enrichedDeps, usageSections, hasUsage, pr.diff);
    return;
  }

  // 10. Post the analysis as a review with inline comments
  let body: string;
  let inlineComments: ReturnType<typeof buildInlineComments>;
  try {
    body = buildReviewBody(assessment);
    inlineComments = buildInlineComments(assessment, enrichedDeps, pr.files);
  } catch {
    await runLegacyFallback(enrichedDeps, usageSections, hasUsage, pr.diff);
    return;
  }

  if (inlineComments.length > 0) {
    try {
      await createReview(octokit, owner, repo, prNumber, body, inlineComments);
    } catch {
      await postComment(octokit, owner, repo, prNumber, body);
    }
  } else {
    await postComment(octokit, owner, repo, prNumber, body);
  }

  // --- Legacy fallback ---
  async function runLegacyFallback(
    deps: EnrichedDependencyChange[],
    usageSects: string,
    usage: boolean,
    diff: string,
  ): Promise<void> {
    const depChangesList = deps
      .map(
        (d) =>
          `- **${d.name}**: ${d.fromVersion} → ${d.toVersion} (${d.ecosystem})`,
      )
      .join("\n");

    let combinedNotes: string | null = null;
    for (const dep of deps) {
      if (dep.releaseNotes) {
        combinedNotes = (combinedNotes ?? "") + `\n\n## ${dep.name}\n${dep.releaseNotes}`;
      }
    }
    const prBodySection = combinedNotes
      ? `**Release Notes:**\n${truncateText(combinedNotes.trim(), 15000, "release notes")}`
      : "**Release Notes:** No release notes available.";

    const prompt = buildLegacyPrompt(depChangesList, prBodySection, usage, usageSects, diff);
    const analysis = await generateContent(model, prompt);

    const comment = `## Gemini Dependency Impact Analysis

${analysis}

---
*${deps.length} dependency change(s) · ${Object.values(usageContext).flat().length} usage site(s) found — Generated by [gemini-dependency-impact](https://github.com/dortort/gemini-actions)*`;

    await postComment(octokit, owner, repo, prNumber, comment);
  }
}
