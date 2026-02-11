import * as core from "@actions/core";
import {
  createGeminiModel,
  generateContent,
  getOctokitClient,
  getRepoContext,
  getIssue,
  getFileContent,
  createPullRequest,
  createBranch,
  createOrUpdateFile,
  getDefaultBranch,
  getRepoTree,
} from "@gemini-actions/shared";

interface FileChange {
  path: string;
  content: string;
}

async function run(): Promise<void> {
  try {
    const issueNumber = parseInt(core.getInput("issue_number", { required: true }), 10);
    const geminiApiKey = core.getInput("gemini_api_key", { required: true });
    const githubToken = core.getInput("github_token", { required: true });
    const modelName = core.getInput("model") || "gemini-2.0-flash";

    const octokit = getOctokitClient(githubToken);
    const { owner, repo } = getRepoContext();
    const model = createGeminiModel(geminiApiKey, modelName);

    core.info(`Processing issue #${issueNumber}...`);

    // 1. Get issue details
    const issue = await getIssue(octokit, owner, repo, issueNumber);
    core.info(`Issue: ${issue.title}`);

    // 2. Get repository structure for context
    const defaultBranch = await getDefaultBranch(octokit, owner, repo);
    const tree = await getRepoTree(octokit, owner, repo, defaultBranch.sha);
    const fileList = tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path);

    // 3. Ask Gemini to identify which files are relevant and what changes to make
    const planPrompt = `You are a software engineer. A GitHub issue has been filed requesting a change to the repository.

**Issue #${issue.number}: ${issue.title}**
${issue.body ?? "No description provided."}

**Repository files:**
${fileList.join("\n")}

Analyze the issue and determine which files need to be created or modified to address it.
Respond with a JSON array of file paths that are relevant. Only include files that need changes.
If new files need to be created, include them too.

Respond ONLY with a JSON array of strings, e.g.: ["src/config.ts", "README.md"]`;

    const planResponse = await generateContent(model, planPrompt);
    let relevantFiles: string[];
    try {
      relevantFiles = JSON.parse(planResponse.replace(/```json?\n?|\n?```/g, "").trim());
    } catch {
      core.warning("Could not parse file plan from Gemini, using issue body heuristics");
      relevantFiles = fileList.slice(0, 10);
    }

    // 4. Fetch content of relevant existing files
    const fileContents: Record<string, string> = {};
    for (const filePath of relevantFiles) {
      if (fileList.includes(filePath)) {
        try {
          fileContents[filePath] = await getFileContent(
            octokit,
            owner,
            repo,
            filePath,
            defaultBranch.name,
          );
        } catch {
          core.debug(`Could not read ${filePath}, may be a new file`);
        }
      }
    }

    // 5. Ask Gemini to generate the actual code changes
    const changePrompt = `You are a software engineer implementing a change based on a GitHub issue.

**Issue #${issue.number}: ${issue.title}**
${issue.body ?? "No description provided."}

**Current file contents:**
${Object.entries(fileContents)
  .map(([path, content]) => `--- ${path} ---\n${content}`)
  .join("\n\n")}

Generate the complete updated file contents for each file that needs to change.
If a file needs to be created, provide its full content.

Respond ONLY with a JSON array of objects with "path" and "content" fields:
[{"path": "src/example.ts", "content": "...full file content..."}]

Important:
- Provide the COMPLETE file content, not just the diff
- Make minimal changes needed to address the issue
- Follow existing code style and conventions`;

    const changeResponse = await generateContent(model, changePrompt);
    let changes: FileChange[];
    try {
      changes = JSON.parse(changeResponse.replace(/```json?\n?|\n?```/g, "").trim());
    } catch {
      throw new Error("Failed to parse code changes from Gemini response");
    }

    if (changes.length === 0) {
      core.info("Gemini determined no changes are needed");
      return;
    }

    // 6. Create a new branch and apply changes
    const branchName = `gemini/issue-${issueNumber}`;
    await createBranch(octokit, owner, repo, branchName, defaultBranch.sha);
    core.info(`Created branch: ${branchName}`);

    for (const change of changes) {
      const existingSha = fileList.includes(change.path)
        ? undefined
        : undefined;

      // Check if file exists to get its SHA for updates
      let sha: string | undefined;
      if (fileList.includes(change.path)) {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: change.path,
            ref: branchName,
          });
          if ("sha" in data) {
            sha = data.sha;
          }
        } catch {
          // File doesn't exist yet, that's fine
        }
      }

      await createOrUpdateFile(
        octokit,
        owner,
        repo,
        change.path,
        change.content,
        `feat: update ${change.path} for issue #${issueNumber}`,
        branchName,
        sha,
      );
      core.info(`Updated: ${change.path}`);
    }

    // 7. Create the pull request
    const prBody = `## Summary

This PR was automatically generated by Gemini to address #${issueNumber}.

### Changes
${changes.map((c) => `- \`${c.path}\``).join("\n")}

### Issue
Closes #${issueNumber}

---
*Generated by [gemini-pr-from-issue](https://github.com/dortort/gemini-actions)*`;

    const prNumber = await createPullRequest(octokit, owner, repo, {
      title: `feat: ${issue.title}`,
      body: prBody,
      head: branchName,
      base: defaultBranch.name,
    });

    core.info(`Created PR #${prNumber}`);
    core.setOutput("pr_number", prNumber.toString());
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
