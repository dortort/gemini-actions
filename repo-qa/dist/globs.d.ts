/**
 * Match a file path against a glob pattern.
 * Supports * (single segment) and ** (any depth).
 */
export declare function matchGlob(filePath: string, pattern: string): boolean;
export declare function matchesAnyGlob(filePath: string, patterns: string[]): boolean;
