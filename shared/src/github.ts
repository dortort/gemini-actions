import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface PullRequestInfo {
  number: number;
  title: string;
  body: string | null;
  diff: string;
  files: PullRequestFile[];
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface IssueInfo {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
}

export function getOctokitClient(token: string): Octokit {
  return github.getOctokit(token);
}

export function getRepoContext(): { owner: string; repo: string } {
  return github.context.repo;
}

export async function getIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueInfo> {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    labels: data.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
  };
}

export async function getPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestInfo> {
  const [prResponse, diffResponse, filesResponse] = await Promise.all([
    octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
    octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: "diff" },
    }),
    octokit.rest.pulls.listFiles({ owner, repo, pull_number: prNumber }),
  ]);

  return {
    number: prResponse.data.number,
    title: prResponse.data.title,
    body: prResponse.data.body,
    diff: diffResponse.data as unknown as string,
    files: filesResponse.data.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    head: {
      ref: prResponse.data.head.ref,
      sha: prResponse.data.head.sha,
    },
    base: {
      ref: prResponse.data.base.ref,
      sha: prResponse.data.base.sha,
    },
  };
}

export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string> {
  const params: { owner: string; repo: string; path: string; ref?: string } = {
    owner,
    repo,
    path,
  };
  if (ref) params.ref = ref;

  const { data } = await octokit.rest.repos.getContent(params);

  if ("content" in data && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  throw new Error(`Unable to read file content for ${path}`);
}

export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  params: {
    title: string;
    body: string;
    head: string;
    base: string;
  },
): Promise<number> {
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    ...params,
  });
  return data.number;
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  side?: "LEFT" | "RIGHT";
}

export async function createReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  comments: ReviewComment[] = [],
): Promise<void> {
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body,
    event: "COMMENT",
    comments: comments.map((c) => ({
      path: c.path,
      line: c.line,
      body: c.body,
      side: c.side ?? "RIGHT",
    })),
  });
}

export async function createOrUpdateFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  existingSha?: string,
): Promise<void> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
  };
  if (existingSha) params.sha = existingSha;

  await octokit.rest.repos.createOrUpdateFileContents(
    params as Parameters<
      typeof octokit.rest.repos.createOrUpdateFileContents
    >[0],
  );
}

export async function createBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  fromSha: string,
): Promise<void> {
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: fromSha,
  });
}

export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<{ name: string; sha: string }> {
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  return { name: defaultBranch, sha: ref.object.sha };
}

export async function getRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  recursive: boolean = true,
): Promise<{ path: string; type: string }[]> {
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: sha,
    recursive: recursive ? "1" : undefined,
  });
  return data.tree
    .filter((item) => item.path && item.type)
    .map((item) => ({
      path: item.path!,
      type: item.type!,
    }));
}
