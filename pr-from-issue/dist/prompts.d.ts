import type { IssueInfo } from "@gemini-actions/shared";
export declare function buildPlanPrompt(issue: IssueInfo, fileListText: string): string;
export declare function buildChangePrompt(issue: IssueInfo, fileContents: Record<string, string>): string;
export declare function buildPrBody(issueNumber: number, changes: {
    path: string;
}[]): string;
