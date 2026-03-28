import { ActionContext } from "@gemini-actions/shared";
export interface PrFromIssueInputs {
    issueNumber: number;
}
export declare function runPrFromIssue(ctx: ActionContext, inputs: PrFromIssueInputs): Promise<{
    prNumber: number;
} | null>;
