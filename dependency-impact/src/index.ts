import * as core from "@actions/core";
import {
  createGeminiModel,
  generateContent,
  truncateText,
  getOctokitClient,
  getRepoContext,
  getPullRequest,
  getFileContent,
  postComment,
  getDefaultBranch,
  getRepoTree,
  listReleaseNotesBetween,
} from "@gemini-actions/shared";
import { parseDependencyChanges, getImportPatterns } from "./parsers";

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

async function run(): Promise<void> {
  try {
    const prNumber = parseInt(core.getInput("pr_number", { required: true }), 10);
    const geminiApiKey = core.getInput("gemini_api_key", { required: true });
    const githubToken = core.getInput("github_token", { required: true });
    const modelName = core.getInput("model") || "gemini-2.0-flash";

    const octokit = getOctokitClient(githubToken);
    const { owner, repo } = getRepoContext();
    const model = createGeminiModel(geminiApiKey, modelName);

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

      // Read a subset of source files to find imports
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
            // Include the relevant lines, not the whole file
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

    // 5. Send to Gemini for analysis
    const maxUsageCharsPerDep = 5000;
    const usageSections = Object.entries(usageContext)
      .map(([name, usages]) => {
        if (usages.length === 0) return `### ${name}\nNo direct imports found in source files.`;
        const joined = usages.join("\n\n");
        return `### ${name}\n${truncateText(joined, maxUsageCharsPerDep, `${name} usage`)}`;
      })
      .join("\n\n");

    const isDependabot = /\[bot\]$/.test(pr.author);
    const hasBody = pr.body != null && pr.body.trim().length > 50;

    let releaseNotes: string | null = null;

    if (isDependabot && hasBody) {
      releaseNotes = pr.body!;
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
            releaseNotes = (releaseNotes ?? "") + `\n\n## ${dep.name}\n${notes}`;
          }
        }
      }
      if (!releaseNotes && hasBody) {
        releaseNotes = pr.body!;
      }
    }

    const prBodySection = releaseNotes
      ? `**Release Notes:**\n${truncateText(releaseNotes.trim(), 15000, "release notes")}`
      : "**Release Notes:** No release notes available.";

    const hasUsage = Object.values(usageContext).some(usages => usages.length > 0);

    const depChangesList = depChanges
      .map(
        (d) =>
          `- **${d.name}**: ${d.fromVersion} → ${d.toVersion} (${d.ecosystem})`,
      )
      .join("\n");

    let prompt: string;

    if (hasUsage) {
      prompt = `You are a dependency upgrade analyst. A pull request updates the following dependencies.
Cross-reference the release notes with actual usage sites in this codebase.

**Dependency Changes:**
${depChangesList}

${prBodySection}

**Usage in Codebase:**
${usageSections}

**PR Diff:**
\`\`\`diff
${truncateText(pr.diff, 10000, "PR diff")}
\`\`\`

Respond with ONLY sections that have content. Skip empty sections entirely.
- **Breaking changes affecting this codebase**: Only mention breaking changes that are confirmed by the release notes AND affect files shown in "Usage in Codebase". Do not speculate.
- **Action required**: Specific code changes needed, referencing actual file paths and line content from the usage context.
- **Risk assessment**: Low / Medium / High with a one-line justification.

RULES:
- Do NOT include generic advice like "review the changelog", "test in staging", "run terraform init", or "pin versions".
- Do NOT fabricate examples, hypothetical scenarios, or breaking changes not confirmed by the release notes.
- If the release notes do not mention breaking changes relevant to the detected usage, say "No breaking changes detected for current usage" and give a risk assessment.`;
    } else {
      prompt = `You are a dependency upgrade analyst. A pull request updates the following dependencies.
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

    const analysis = await generateContent(model, prompt);

    // 6. Post the analysis as a comment
    const comment = `## Gemini Dependency Impact Analysis

${analysis}

---
*${depChanges.length} dependency change(s) · ${Object.values(usageContext).flat().length} usage site(s) found — Generated by [gemini-dependency-impact](https://github.com/dortort/gemini-actions)*`;

    await postComment(octokit, owner, repo, prNumber, comment);
    core.info("Dependency impact analysis posted");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
