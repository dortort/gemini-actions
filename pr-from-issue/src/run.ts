import {
  generateContent,
  truncateText,
  parseJsonResponse,
  getIssue,
  getFileContent,
  createPullRequest,
  createBranch,
  createOrUpdateFile,
  getDefaultBranch,
  getRepoTree,
  ActionContext,
} from "@gemini-actions/shared";
import { buildPlanPrompt, buildChangePrompt, buildPrBody } from "./prompts";

interface FileChange {
  path: string;
  content: string;
}

export interface PrFromIssueInputs {
  issueNumber: number;
}

export async function runPrFromIssue(
  ctx: ActionContext,
  inputs: PrFromIssueInputs,
): Promise<{ prNumber: number } | null> {
  const { octokit, owner, repo, model } = ctx;
  const { issueNumber } = inputs;

  // 1. Get issue details
  const issue = await getIssue(octokit, owner, repo, issueNumber);

  // 2. Get repository structure for context
  const defaultBranch = await getDefaultBranch(octokit, owner, repo);
  const tree = await getRepoTree(octokit, owner, repo, defaultBranch.sha);
  const fileList = tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path);

  // 3. Ask Gemini to identify which files are relevant
  const fileListText = truncateText(fileList.join("\n"), 50000, "file list");
  const planResponse = await generateContent(model, buildPlanPrompt(issue, fileListText));
  let relevantFiles: string[];
  try {
    relevantFiles = parseJsonResponse<string[]>(planResponse);
  } catch {
    relevantFiles = fileList.slice(0, 10);
  }

  // 4. Fetch content of relevant existing files
  const maxFilesForContext = 20;
  const maxFileChars = 10000;
  const fileContents: Record<string, string> = {};
  for (const filePath of relevantFiles.slice(0, maxFilesForContext)) {
    if (fileList.includes(filePath)) {
      try {
        const raw = await getFileContent(
          octokit,
          owner,
          repo,
          filePath,
          defaultBranch.name,
        );
        fileContents[filePath] = truncateText(raw, maxFileChars, filePath);
      } catch {
        // May be a new file
      }
    }
  }

  // 5. Ask Gemini to generate the actual code changes
  const changeResponse = await generateContent(model, buildChangePrompt(issue, fileContents));
  const changes = parseJsonResponse<FileChange[]>(changeResponse);

  if (changes.length === 0) {
    return null;
  }

  // 6. Create a new branch and apply changes
  const branchName = `gemini/issue-${issueNumber}`;
  await createBranch(octokit, owner, repo, branchName, defaultBranch.sha);

  for (const change of changes) {
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
        // File doesn't exist yet
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
  }

  // 7. Create the pull request
  const prNumber = await createPullRequest(octokit, owner, repo, {
    title: `feat: ${issue.title}`,
    body: buildPrBody(issueNumber, changes),
    head: branchName,
    base: defaultBranch.name,
  });

  return { prNumber };
}
