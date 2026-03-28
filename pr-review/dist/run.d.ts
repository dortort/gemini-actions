import { ActionContext } from "@gemini-actions/shared";
export interface PrReviewInputs {
    prNumber: number;
    strictness: string;
}
export declare function runPrReview(ctx: ActionContext, inputs: PrReviewInputs): Promise<void>;
