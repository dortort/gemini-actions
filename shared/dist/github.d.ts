import * as github from "@actions/github";
type Octokit = ReturnType<typeof github.getOctokit>;
export interface PullRequestInfo {
    number: number;
    title: string;
    body: string | null;
    diff: string;
    files: PullRequestFile[];
    head: {
        ref: string;
        sha: string;
    };
    base: {
        ref: string;
        sha: string;
    };
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
export declare function getOctokitClient(token: string): Octokit;
export declare function getRepoContext(): {
    owner: string;
    repo: string;
};
export declare function getIssue(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<IssueInfo>;
export declare function getPullRequest(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<PullRequestInfo>;
export declare function getFileContent(octokit: Octokit, owner: string, repo: string, path: string, ref?: string): Promise<string>;
export declare function postComment(octokit: Octokit, owner: string, repo: string, issueNumber: number, body: string): Promise<void>;
export declare function createPullRequest(octokit: Octokit, owner: string, repo: string, params: {
    title: string;
    body: string;
    head: string;
    base: string;
}): Promise<number>;
export interface ReviewComment {
    path: string;
    line: number;
    body: string;
    side?: "LEFT" | "RIGHT";
}
export declare function createReview(octokit: Octokit, owner: string, repo: string, prNumber: number, body: string, comments?: ReviewComment[]): Promise<void>;
export declare function createOrUpdateFile(octokit: Octokit, owner: string, repo: string, path: string, content: string, message: string, branch: string, existingSha?: string): Promise<void>;
export declare function createBranch(octokit: Octokit, owner: string, repo: string, branchName: string, fromSha: string): Promise<void>;
export declare function getDefaultBranch(octokit: Octokit, owner: string, repo: string): Promise<{
    name: string;
    sha: string;
}>;
export declare function getRepoTree(octokit: Octokit, owner: string, repo: string, sha: string, recursive?: boolean): Promise<{
    path: string;
    type: string;
}[]>;
export {};
//# sourceMappingURL=github.d.ts.map