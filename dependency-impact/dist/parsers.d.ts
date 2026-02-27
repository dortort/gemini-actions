export interface DependencyChange {
    name: string;
    fromVersion: string;
    toVersion: string;
    ecosystem: string;
}
export declare function parseDependencyChanges(diff: string, files: {
    filename: string;
    patch?: string;
}[]): DependencyChange[];
import { UpgradeType } from "./types";
/**
 * Classify a version change as major, minor, patch, or unknown.
 */
export declare function classifyUpgrade(from: string, to: string): UpgradeType;
/**
 * Find the line number in the new file where a dependency's version appears as
 * an added line in a diff patch. Returns null if not found.
 */
export declare function findDepLineInPatch(patch: string, depName: string): number | null;
export declare function getImportPatterns(depName: string, ecosystem: string): string[];
/**
 * Extract the section of a Dependabot PR body relevant to a specific dependency.
 *
 * Dependabot group PRs embed per-dependency release notes inside `<details>`
 * blocks whose content mentions the package name.  This function returns only
 * the matching block(s) instead of the full body, avoiding token duplication
 * when the body is attached to every dependency.
 *
 * Falls back to the full body when no per-dep section can be isolated (e.g.
 * single-dependency Dependabot PRs where the whole body is relevant).
 */
export declare function extractDependabotSection(body: string, depName: string): string;
