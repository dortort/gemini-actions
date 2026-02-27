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
