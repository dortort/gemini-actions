import { PullRequestInfo } from "@gemini-actions/shared";
export declare const STRICTNESS_PROMPTS: Record<string, string>;
export declare function buildFileSections(pr: PullRequestInfo, maxPatchPerFile?: number, maxTotalDiff?: number): string[];
export declare function buildReviewPrompt(pr: PullRequestInfo, strictness: string, fileSections: string[]): string;
