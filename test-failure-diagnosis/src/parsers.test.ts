import { describe, it, expect } from "vitest";
import { extractTestFilePaths } from "./parsers";

describe("extractTestFilePaths", () => {
  it("extracts Jest/Vitest FAIL paths", () => {
    const output = `FAIL src/utils/auth.test.ts
  ● login › should authenticate user`;
    const result = extractTestFilePaths(output);
    expect(result).toContain("src/utils/auth.test.ts");
  });

  it("extracts pytest FAILED paths", () => {
    const output = `FAILED tests/test_auth.py::test_login - AssertionError`;
    const result = extractTestFilePaths(output);
    expect(result).toContain("tests/test_auth.py");
  });

  it("extracts Go test file paths", () => {
    const output = `--- FAIL: TestAuth (pkg/auth/auth_test.go:42)`;
    const result = extractTestFilePaths(output);
    expect(result).toContain("pkg/auth/auth_test.go");
  });

  it("extracts generic test file paths", () => {
    const output = `Error in src/components/Button.test.js:15`;
    const result = extractTestFilePaths(output);
    expect(result).toContain("src/components/Button.test.js");
  });

  it("extracts tsx test files via FAIL prefix", () => {
    const output = `FAIL src/components/Button.test.tsx`;
    const result = extractTestFilePaths(output);
    expect(result).toContain("src/components/Button.test.tsx");
  });

  it("deduplicates paths", () => {
    const output = `FAIL src/a.test.ts
FAIL src/a.test.ts`;
    const result = extractTestFilePaths(output);
    expect(result.filter((p) => p === "src/a.test.ts")).toHaveLength(1);
  });

  it("strips leading ./ from paths", () => {
    const output = `FAIL ./src/foo.test.ts`;
    const result = extractTestFilePaths(output);
    expect(result).toContain("src/foo.test.ts");
  });

  it("excludes node_modules paths", () => {
    const output = `Error in node_modules/lib/index.test.js:1`;
    const result = extractTestFilePaths(output);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for output with no test files", () => {
    const output = `Build succeeded.`;
    const result = extractTestFilePaths(output);
    expect(result).toHaveLength(0);
  });
});
