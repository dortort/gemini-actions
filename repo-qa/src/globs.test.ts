import { describe, it, expect } from "vitest";
import { matchGlob, matchesAnyGlob } from "./globs";

describe("matchGlob", () => {
  it("matches exact file paths", () => {
    expect(matchGlob("src/index.ts", "src/index.ts")).toBe(true);
  });

  it("matches single-segment wildcards", () => {
    expect(matchGlob("src/index.ts", "src/*.ts")).toBe(true);
    expect(matchGlob("src/deep/index.ts", "src/*.ts")).toBe(false);
  });

  it("matches globstar patterns with nested paths", () => {
    expect(matchGlob("src/deep/nested/file.ts", "src/**/*.ts")).toBe(true);
  });

  it("does not match single-level paths with **/ pattern (requires subdirectory)", () => {
    // src/**/*.ts requires at least one directory between src/ and the file
    expect(matchGlob("src/index.ts", "src/**/*.ts")).toBe(false);
    // Use src/** or src/*.ts instead for single-level matching
    expect(matchGlob("src/index.ts", "src/**")).toBe(true);
    expect(matchGlob("src/index.ts", "src/*.ts")).toBe(true);
  });

  it("matches globstar at the end", () => {
    expect(matchGlob("src/index.ts", "src/**")).toBe(true);
    expect(matchGlob("src/a/b/c.js", "src/**")).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(matchGlob("lib/index.ts", "src/**/*.ts")).toBe(false);
  });

  it("handles dots in file extensions", () => {
    expect(matchGlob("file.test.ts", "*.test.ts")).toBe(true);
    expect(matchGlob("file.spec.ts", "*.test.ts")).toBe(false);
  });
});

describe("matchesAnyGlob", () => {
  it("matches if any pattern matches", () => {
    expect(matchesAnyGlob("src/a.ts", ["src/**", "lib/**"])).toBe(true);
    expect(matchesAnyGlob("lib/b.ts", ["src/**", "lib/**"])).toBe(true);
  });

  it("returns false if no patterns match", () => {
    expect(matchesAnyGlob("test/a.ts", ["src/**", "lib/**"])).toBe(false);
  });
});
