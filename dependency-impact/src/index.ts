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
} from "@gemini-actions/shared";

interface DependencyChange {
  name: string;
  fromVersion: string;
  toVersion: string;
  ecosystem: string;
}

function parseDependencyChanges(diff: string, files: { filename: string; patch?: string }[]): DependencyChange[] {
  const changes: DependencyChange[] = [];

  for (const file of files) {
    if (!file.patch) continue;

    // Parse package.json changes (npm)
    if (file.filename.endsWith("package.json") || file.filename.endsWith("package-lock.json")) {
      const depRegex = /^[-+]\s*"([^"]+)":\s*"[^]*?(\d+\.\d+\.\d+[^"]*)"/gm;
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const match = line.match(/^([-+])\s*"([^"]+)":\s*"[~^]?(\d+[^"]*)"/)
        if (match) {
          if (match[1] === "-") removed.set(match[2], match[3]);
          else added.set(match[2], match[3]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "npm" });
        }
      }
    }

    // Parse requirements.txt changes (Python)
    if (file.filename.endsWith("requirements.txt") || file.filename.endsWith("Pipfile")) {
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const match = line.match(/^([-+])([a-zA-Z0-9_-]+)[=<>~!]+(\d+\S*)/);
        if (match) {
          if (match[1] === "-") removed.set(match[2], match[3]);
          else added.set(match[2], match[3]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "pip" });
        }
      }
    }

    // Parse go.mod changes (Go)
    if (file.filename === "go.mod") {
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const match = line.match(/^([-+])\s*(\S+)\s+v(\S+)/);
        if (match) {
          if (match[1] === "-") removed.set(match[2], match[3]);
          else added.set(match[2], match[3]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "go" });
        }
      }
    }
  }

  return changes;
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
      .filter((item) => /\.(ts|js|tsx|jsx|py|go|java|rb|rs)$/.test(item.path))
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

    const prompt = `You are a dependency upgrade analyst. A pull request updates the following dependencies.
For each dependency, analyze the impact on the codebase.

**Dependency Changes:**
${depChanges
  .map(
    (d) =>
      `- **${d.name}**: ${d.fromVersion} → ${d.toVersion} (${d.ecosystem})`,
  )
  .join("\n")}

**Usage in Codebase:**
${usageSections}

**PR Diff:**
\`\`\`diff
${truncateText(pr.diff, 10000, "PR diff")}
\`\`\`

For each dependency, provide:
1. **Breaking changes**: Known breaking changes between these versions that affect this codebase
2. **Affected files**: Which files in the codebase use APIs that changed
3. **Migration steps**: Specific steps needed to adapt the codebase (if any)
4. **Risk assessment**: Low / Medium / High risk based on actual usage

Format your response as a markdown report. Be specific — reference actual file paths and API usage from the codebase.
If you don't have enough information about a dependency's changelog, say so and recommend reviewing the release notes manually.`;

    const analysis = await generateContent(model, prompt);

    // 6. Post the analysis as a comment
    const comment = `## Gemini Dependency Impact Analysis

${analysis}

---
*Analyzed ${depChanges.length} dependency change(s) across ${Object.values(usageContext).flat().length} usage site(s) — Generated by [gemini-dependency-impact](https://github.com/dortort/gemini-actions)*`;

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

function getImportPatterns(depName: string, ecosystem: string): string[] {
  switch (ecosystem) {
    case "npm":
      return [
        `from "${depName}"`,
        `from '${depName}'`,
        `require("${depName}")`,
        `require('${depName}')`,
        `from "${depName}/`,
        `from '${depName}/`,
      ];
    case "pip":
      return [`import ${depName}`, `from ${depName}`];
    case "go":
      return [`"${depName}"`, `"${depName}/`];
    default:
      return [depName];
  }
}

run();
