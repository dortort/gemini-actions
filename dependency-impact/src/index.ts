import * as core from "@actions/core";
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
  runAction,
  getActionContext,
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

async function resolveGitHubRepo(dep: { name: string; ecosystem: string }): Promise<{ owner: string; repo: string } | null> {
  if (dep.ecosystem === "go" && dep.name.startsWith("github.com/")) {
    const parts = dep.name.replace("github.com/", "").split("/");
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
  }
  if (dep.ecosystem === "terraform" && dep.name.startsWith("registry.terraform.io/")) {
    const parts = dep.name.replace("registry.terraform.io/", "").split("/");
    if (parts.length >= 2) return { owner: parts[0], repo: `terraform-provider-${parts[1]}` };
  }
  if (dep.ecosystem === "npm") {
    try {
      const res = await fetch(`https://registry.npmjs.org/${dep.name}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const url = (data?.repository as Record<string, unknown>)?.url;
        if (typeof url === "string") {
          const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
          const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
          if (match) return { owner: match[1], repo: match[2] };
        }
      }
    } catch {
      // Registry lookup failed — fall through
    }
  }
  if (dep.ecosystem === "composer") {
    try {
      const res = await fetch(`https://packagist.org/packages/${dep.name}.json`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const versions = (data?.package as Record<string, unknown>)?.versions as Record<string, Record<string, unknown>> | undefined;
        if (versions && typeof versions === "object") {
          const firstKey = Object.keys(versions)[0];
          const url = (versions[firstKey]?.source as Record<string, unknown>)?.url;
          if (typeof url === "string") {
            const cleaned = url.replace(/\.git$/, "");
            const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (match) return { owner: match[1], repo: match[2] };
          }
        }
      }
    } catch {
      // Registry lookup failed — fall through
    }
  }
  return null;
}

runAction(async () => {
  const prNumber = parseInt(core.getInput("pr_number", { required: true }), 10);

  const { octokit, owner, repo, model } = getActionContext();

  core.info(`Analyzing dependency impact for PR #${prNumber}...`);

  // 1. Get PR details
  const pr = await getPullRequest(octokit, owner, repo, prNumber);
  core.info(`PR: ${pr.title}`);

  // 2. Parse dependency changes from the diff
  const depChanges = parseDependencyChanges(pr.diff, pr.files);

  if (depChanges.length === 0) {
    core.info("No dependency version changes detected in this PR");
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      "## Gemini Dependency Impact Analysis\n\nNo dependency version changes detected in this PR.",
    );
    return;
  }

  core.info(`Found ${depChanges.length} dependency change(s): ${depChanges.map((d) => d.name).join(", ")}`);

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

  if (isDependabot && hasBody) {
    // Dependabot PRs embed release notes in the body — extract per-dep sections
    for (const dep of depChanges) {
      releaseNotesPerDep.set(dep.name, extractDependabotSection(pr.body!, dep.name));
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
          releaseNotesPerDep.set(dep.name, notes);
        }
      }
    }
    // Fall back to PR body if no GitHub Releases found
    if (releaseNotesPerDep.size === 0 && hasBody) {
      for (const dep of depChanges) {
        releaseNotesPerDep.set(dep.name, pr.body!);
      }
    }
  }

  // 6. Enrich dependency changes with upgrade type and release notes
  const enrichedDeps: EnrichedDependencyChange[] = depChanges.map((dep) => ({
    ...dep,
    upgradeType: classifyUpgrade(dep.fromVersion, dep.toVersion),
    releaseNotes: releaseNotesPerDep.get(dep.name) ?? null,
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

  // 7. Step 1: Extract breaking changes from release notes
  core.info("Step 1: Extracting breaking changes from release notes...");
  let step1Result: Step1Result;
  try {
    const step1Response = await generateContent(model, buildStep1Prompt(enrichedDeps), 200_000);
    step1Result = parseJsonResponse<Step1Result>(step1Response);
    core.info(
      `Step 1 complete: ${step1Result.dependencies.filter((d) => d.hasConfirmedBreakingChanges).length} dep(s) with breaking changes`,
    );
  } catch (err) {
    core.warning(`Step 1 failed (${err instanceof Error ? err.message : err}), falling back to legacy prompt`);
    await runLegacyFallback(enrichedDeps, usageSections, hasUsage, pr.diff);
    return;
  }

  // 8. Step 2: Cross-reference with codebase usage (conditional)
  const hasBreakingChanges = step1Result.dependencies.some(
    (d) =>
      d.hasConfirmedBreakingChanges ||
      d.deprecations.length > 0 ||
      d.notableChanges.length > 0,
  );

  let step2Result: Step2Result = { impacts: [], unaffectedUsages: [] };

  if (hasUsage && hasBreakingChanges) {
    core.info("Step 2: Cross-referencing breaking changes with codebase usage...");
    try {
      const step2Response = await generateContent(model, buildStep2Prompt(step1Result, usageSections), 300_000);
      step2Result = parseJsonResponse<Step2Result>(step2Response);
      core.info(`Step 2 complete: ${step2Result.impacts.length} impact(s) found`);
    } catch (err) {
      core.warning(`Step 2 failed (${err instanceof Error ? err.message : err}), proceeding with empty impact analysis`);
    }
  } else {
    core.info("Step 2: Skipped — no breaking changes or no codebase usage detected");
  }

  // 9. Step 3: Synthesize final assessment
  core.info("Step 3: Synthesizing final assessment...");
  let assessment: DependencyAssessment;
  try {
    const step3Prompt = hasUsage
      ? buildStep3Prompt(enrichedDeps, step1Result, step2Result)
      : buildStep3NoUsagePrompt(enrichedDeps, step1Result);

    const step3Response = await generateContent(model, step3Prompt, 100_000);
    assessment = parseJsonResponse<DependencyAssessment>(step3Response);
    core.info(`Step 3 complete: overall risk = ${assessment.overallRisk}`);
  } catch (err) {
    core.warning(`Step 3 failed (${err instanceof Error ? err.message : err}), falling back to legacy prompt`);
    await runLegacyFallback(enrichedDeps, usageSections, hasUsage, pr.diff);
    return;
  }

  // 10. Post the analysis as a review with inline comments
  const body = buildReviewBody(assessment);
  const inlineComments = buildInlineComments(assessment, enrichedDeps, pr.files);

  if (inlineComments.length > 0) {
    await createReview(octokit, owner, repo, prNumber, body, inlineComments);
  } else {
    await postComment(octokit, owner, repo, prNumber, body);
  }

  core.info(
    `Dependency impact analysis posted (${inlineComments.length} inline comment(s))`,
  );

  // --- Legacy fallback for when structured pipeline fails ---
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
    core.info("Dependency impact analysis posted (legacy fallback)");
  }
});
