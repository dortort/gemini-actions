import { ActionContext } from "@gemini-actions/shared";
import type { RegistryResolver } from "./registry";
export interface DependencyImpactInputs {
    prNumber: number;
}
export declare function runDependencyImpact(ctx: ActionContext, inputs: DependencyImpactInputs, resolveGitHubRepo: RegistryResolver): Promise<void>;
