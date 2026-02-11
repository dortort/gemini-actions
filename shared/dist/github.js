"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOctokitClient = getOctokitClient;
exports.getRepoContext = getRepoContext;
exports.getIssue = getIssue;
exports.getPullRequest = getPullRequest;
exports.getFileContent = getFileContent;
exports.postComment = postComment;
exports.createPullRequest = createPullRequest;
exports.createReview = createReview;
exports.createOrUpdateFile = createOrUpdateFile;
exports.createBranch = createBranch;
exports.getDefaultBranch = getDefaultBranch;
exports.getRepoTree = getRepoTree;
const github = __importStar(require("@actions/github"));
function getOctokitClient(token) {
    return github.getOctokit(token);
}
function getRepoContext() {
    return github.context.repo;
}
async function getIssue(octokit, owner, repo, issueNumber) {
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
async function getPullRequest(octokit, owner, repo, prNumber) {
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
        diff: diffResponse.data,
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
async function getFileContent(octokit, owner, repo, path, ref) {
    const params = {
        owner,
        repo,
        path,
    };
    if (ref)
        params.ref = ref;
    const { data } = await octokit.rest.repos.getContent(params);
    if ("content" in data && data.content) {
        return Buffer.from(data.content, "base64").toString("utf-8");
    }
    throw new Error(`Unable to read file content for ${path}`);
}
async function postComment(octokit, owner, repo, issueNumber, body) {
    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
    });
}
async function createPullRequest(octokit, owner, repo, params) {
    const { data } = await octokit.rest.pulls.create({
        owner,
        repo,
        ...params,
    });
    return data.number;
}
async function createReview(octokit, owner, repo, prNumber, body, comments = []) {
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
async function createOrUpdateFile(octokit, owner, repo, path, content, message, branch, existingSha) {
    const params = {
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        branch,
    };
    if (existingSha)
        params.sha = existingSha;
    await octokit.rest.repos.createOrUpdateFileContents(params);
}
async function createBranch(octokit, owner, repo, branchName, fromSha) {
    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: fromSha,
    });
}
async function getDefaultBranch(octokit, owner, repo) {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
    });
    return { name: defaultBranch, sha: ref.object.sha };
}
async function getRepoTree(octokit, owner, repo, sha, recursive = true) {
    const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: sha,
        recursive: recursive ? "1" : undefined,
    });
    return data.tree
        .filter((item) => item.path && item.type)
        .map((item) => ({
        path: item.path,
        type: item.type,
    }));
}
//# sourceMappingURL=github.js.map