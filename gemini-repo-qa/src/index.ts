import * as core from "@actions/core";
import {
  createGeminiModel,
  generateContent,
  getOctokitClient,
  getRepoContext,
  getIssue,
  getFileContent,
  postComment,
  getDefaultBranch,
  getRepoTree,
} from "@gemini-actions/shared";

function matchGlob(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${regexStr}$`).test(filePath);
}

function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlob(filePath, pattern));
}

async function run(): Promise<void> {
  try {
    const issueNumberStr = core.getInput("issue_number");
    const discussionIdStr = core.getInput("discussion_id");
    const sourcePaths = core.getInput("source_paths") || "src/**";
    const geminiApiKey = core.getInput("gemini_api_key", { required: true });
    const githubToken = core.getInput("github_token", { required: true });
    const modelName = core.getInput("model") || "gemini-2.0-flash";

    if (!issueNumberStr && !discussionIdStr) {
      throw new Error(
        "Either issue_number or discussion_id must be provided",
      );
    }

    const octokit = getOctokitClient(githubToken);
    const { owner, repo } = getRepoContext();
    const model = createGeminiModel(geminiApiKey, modelName);

    // 1. Get the question
    let question: string;
    let questionTitle: string;
    let responseTarget: { type: "issue"; number: number } | { type: "discussion"; id: string };

    if (issueNumberStr) {
      const issueNumber = parseInt(issueNumberStr, 10);
      const issue = await getIssue(octokit, owner, repo, issueNumber);
      questionTitle = issue.title;
      question = `${issue.title}\n\n${issue.body ?? ""}`;
      responseTarget = { type: "issue", number: issueNumber };
      core.info(`Question from issue #${issueNumber}: ${issue.title}`);
    } else {
      const discussionId = discussionIdStr!;
      // Fetch discussion via GraphQL
      const { repository } = await octokit.graphql<{
        repository: {
          discussion: {
            title: string;
            body: string;
            number: number;
          };
        };
      }>(
        `query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              title
              body
              number
            }
          }
        }`,
        { owner, repo, number: parseInt(discussionId, 10) },
      );

      questionTitle = repository.discussion.title;
      question = `${repository.discussion.title}\n\n${repository.discussion.body}`;
      responseTarget = { type: "discussion", id: discussionId };
      core.info(`Question from discussion #${discussionId}: ${questionTitle}`);
    }

    // 2. Get repository file tree and filter by source_paths
    const defaultBranch = await getDefaultBranch(octokit, owner, repo);
    const tree = await getRepoTree(octokit, owner, repo, defaultBranch.sha);

    const globs = sourcePaths.split(",").map((s) => s.trim());
    const sourceFiles = tree
      .filter((item) => item.type === "blob")
      .filter((item) => matchesAnyGlob(item.path, globs))
      .map((item) => item.path);

    core.info(`Found ${sourceFiles.length} source files matching: ${sourcePaths}`);

    // 3. Ask Gemini to identify relevant files based on the question
    const fileSelectionPrompt = `A user asked a question about a codebase. Which files are most likely relevant to answering it?

**Question:** ${question}

**Available files:**
${sourceFiles.join("\n")}

Return a JSON array of the most relevant file paths (max 20 files). Consider the question topic and select files that would contain the answer.
Respond ONLY with a JSON array of strings.`;

    const fileSelectionResponse = await generateContent(model, fileSelectionPrompt);
    let relevantFiles: string[];
    try {
      relevantFiles = JSON.parse(
        fileSelectionResponse.replace(/```json?\n?|\n?```/g, "").trim(),
      );
      // Validate that selected files actually exist in our tree
      relevantFiles = relevantFiles.filter((f) => sourceFiles.includes(f));
    } catch {
      core.warning("Could not parse file selection, using first 15 source files");
      relevantFiles = sourceFiles.slice(0, 15);
    }

    core.info(`Reading ${relevantFiles.length} relevant files...`);

    // 4. Fetch content of relevant files
    const fileContents: Record<string, string> = {};
    for (const filePath of relevantFiles) {
      try {
        const content = await getFileContent(
          octokit,
          owner,
          repo,
          filePath,
          defaultBranch.name,
        );
        // Limit individual file size
        fileContents[filePath] = content.slice(0, 5000);
      } catch {
        core.debug(`Could not read ${filePath}`);
      }
    }

    // 5. Generate answer
    const answerPrompt = `You are a knowledgeable assistant for the ${owner}/${repo} repository. A user has asked a question, and you have access to relevant source files. Answer the question with specific references to the code.

**Question:** ${question}

**Source Files:**
${Object.entries(fileContents)
  .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}

Guidelines:
- Reference specific files and line numbers when explaining concepts
- Use code snippets from the actual source to illustrate your points
- If the source files don't contain enough information to fully answer the question, say so
- Structure your answer clearly with headers if needed
- Be concise but thorough`;

    const answer = await generateContent(model, answerPrompt);

    // 6. Post the answer
    const responseBody = `## Answer

${answer}

---
*Based on ${Object.keys(fileContents).length} source file(s) — Generated by [gemini-repo-qa](https://github.com/dortort/gemini-actions)*`;

    if (responseTarget.type === "issue") {
      await postComment(octokit, owner, repo, responseTarget.number, responseBody);
      core.info(`Answer posted on issue #${responseTarget.number}`);
    } else {
      // Post discussion comment via GraphQL
      // First get the discussion node ID
      const { repository } = await octokit.graphql<{
        repository: {
          discussion: {
            id: string;
          };
        };
      }>(
        `query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              id
            }
          }
        }`,
        { owner, repo, number: parseInt(responseTarget.id, 10) },
      );

      await octokit.graphql(
        `mutation($discussionId: ID!, $body: String!) {
          addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
            comment {
              id
            }
          }
        }`,
        { discussionId: repository.discussion.id, body: responseBody },
      );
      core.info(`Answer posted on discussion #${responseTarget.id}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
