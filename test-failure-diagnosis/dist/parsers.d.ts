/**
 * Extract test file paths from test runner output.
 * Supports Jest/Vitest, pytest, Go test, and generic patterns.
 */
export declare function extractTestFilePaths(testOutput: string): string[];
