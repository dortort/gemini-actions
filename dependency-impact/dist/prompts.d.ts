import type { EnrichedDependencyChange, Step1Result, Step2Result } from "./types";
export declare function buildStep1Prompt(enrichedDeps: EnrichedDependencyChange[]): string;
export declare function buildStep2Prompt(step1Result: Step1Result, usageSections: string): string;
export declare function buildStep3Prompt(enrichedDeps: EnrichedDependencyChange[], step1Result: Step1Result, step2Result: Step2Result): string;
export declare function buildStep3NoUsagePrompt(enrichedDeps: EnrichedDependencyChange[], step1Result: Step1Result): string;
/**
 * Legacy single-prompt fallback, used when structured pipeline JSON parsing fails.
 */
export declare function buildLegacyPrompt(depChangesList: string, prBodySection: string, hasUsage: boolean, usageSections: string, prDiff: string): string;
