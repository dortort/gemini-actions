/**
 * Extract test file paths from test runner output.
 * Supports Jest/Vitest, pytest, Go test, and generic patterns.
 */
export function extractTestFilePaths(testOutput: string): string[] {
  const paths = new Set<string>();

  const patterns = [
    // Jest/Vitest: FAIL src/tests/foo.test.ts
    /(?:FAIL|FAILED)\s+(\S+\.(?:test|spec)\.\w+)/g,
    // pytest: FAILED tests/test_foo.py::test_bar
    /FAILED\s+(\S+\.py)::/g,
    // Go: --- FAIL: TestFoo (path/to/test.go:42)
    /\(([^)]+_test\.go):\d+\)/g,
    // Generic file paths with test in the name
    /(\S+(?:test|spec)\S*\.(?:ts|js|tsx|jsx|py|go|java|rb))/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(testOutput)) !== null) {
      const filePath = match[1].replace(/^\.\//, "");
      if (!filePath.includes("node_modules")) {
        paths.add(filePath);
      }
    }
  }

  return [...paths];
}
