import type { PullRequestInfo, ReviewComment } from "@gemini-actions/shared";
export interface GeminiReviewComment {
    path: string;
    line: number;
    severity: "critical" | "warning" | "suggestion" | "nitpick";
    comment: string;
}
export interface GeminiReview {
    summary: string;
    comments: GeminiReviewComment[];
}
export declare function filterValidComments(comments: GeminiReviewComment[], pr: PullRequestInfo): ReviewComment[];
export declare function buildSummaryBody(review: GeminiReview, strictness: string): string;
