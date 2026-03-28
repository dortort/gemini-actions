import { ActionContext } from "@gemini-actions/shared";
export interface RepoQAInputs {
    issueNumber?: number;
    discussionId?: string;
    sourcePaths: string;
}
export declare function runRepoQA(ctx: ActionContext, inputs: RepoQAInputs): Promise<void>;
