import { ActionContext } from "@gemini-actions/shared";
export interface TestFailureDiagnosisInputs {
    prNumber: number;
    testOutput: string;
}
export declare function runTestFailureDiagnosis(ctx: ActionContext, inputs: TestFailureDiagnosisInputs): Promise<void>;
