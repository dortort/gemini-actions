import { ActionContext } from "@gemini-actions/shared";
import type { DatadogClient } from "./datadog";
type ActionType = "open_issue" | "comment_on_pr" | "trigger_workflow";
export interface DatadogResponderInputs {
    query: string;
    action: ActionType;
}
export declare function runDatadogResponder(ctx: ActionContext, inputs: DatadogResponderInputs, ddClient: DatadogClient): Promise<string>;
export {};
