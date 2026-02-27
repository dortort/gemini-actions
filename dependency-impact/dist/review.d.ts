import type { ReviewComment, PullRequestFile } from "@gemini-actions/shared";
import type { DependencyAssessment, EnrichedDependencyChange } from "./types";
/**
 * Build the review body with a summary table and narrative.
 */
export declare function buildReviewBody(assessment: DependencyAssessment): string;
/**
 * Build inline review comments for dependency version-change lines in manifest files.
 */
export declare function buildInlineComments(assessment: DependencyAssessment, enrichedDeps: EnrichedDependencyChange[], prFiles: PullRequestFile[]): ReviewComment[];
