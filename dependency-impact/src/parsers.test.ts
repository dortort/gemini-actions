import { describe, it, expect } from "vitest";
import { parseDependencyChanges, getImportPatterns, classifyUpgrade, findDepLineInPatch, extractDependabotSection } from "./parsers";

describe("parseDependencyChanges", () => {
  describe("terraform", () => {
    it("detects a single provider version change", () => {
      const patch = [
        ` provider "registry.terraform.io/hashicorp/aws" {`,
        `-  version     = "5.31.0"`,
        `+  version     = "5.32.0"`,
        `   constraints = "~> 5.0"`,
        ` }`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl", patch },
      ]);

      expect(result).toEqual([
        {
          name: "registry.terraform.io/hashicorp/aws",
          fromVersion: "5.31.0",
          toVersion: "5.32.0",
          ecosystem: "terraform",
        },
      ]);
    });

    it("detects multiple providers changing in the same lock file", () => {
      const patch = [
        ` provider "registry.terraform.io/hashicorp/aws" {`,
        `-  version     = "5.31.0"`,
        `+  version     = "5.32.0"`,
        `   constraints = "~> 5.0"`,
        ` }`,
        ``,
        ` provider "registry.terraform.io/hashicorp/google" {`,
        `-  version     = "5.10.0"`,
        `+  version     = "5.11.0"`,
        `   constraints = "~> 5.0"`,
        ` }`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl", patch },
      ]);

      expect(result).toEqual([
        {
          name: "registry.terraform.io/hashicorp/aws",
          fromVersion: "5.31.0",
          toVersion: "5.32.0",
          ecosystem: "terraform",
        },
        {
          name: "registry.terraform.io/hashicorp/google",
          fromVersion: "5.10.0",
          toVersion: "5.11.0",
          ecosystem: "terraform",
        },
      ]);
    });

    it("skips newly added providers with no prior version", () => {
      const patch = [
        `+provider "registry.terraform.io/hashicorp/azurerm" {`,
        `+  version     = "3.85.0"`,
        `+  constraints = "~> 3.0"`,
        `+}`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl", patch },
      ]);

      expect(result).toEqual([]);
    });

    it("skips removed providers with no new version", () => {
      const patch = [
        `-provider "registry.terraform.io/hashicorp/azurerm" {`,
        `-  version     = "3.85.0"`,
        `-  constraints = "~> 3.0"`,
        `-}`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl", patch },
      ]);

      expect(result).toEqual([]);
    });

    it("skips providers where version did not change", () => {
      const patch = [
        ` provider "registry.terraform.io/hashicorp/aws" {`,
        `   version     = "5.31.0"`,
        `   constraints = "~> 5.0"`,
        ` }`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl", patch },
      ]);

      expect(result).toEqual([]);
    });

    it("handles lock file in a subdirectory", () => {
      const patch = [
        ` provider "registry.terraform.io/hashicorp/aws" {`,
        `-  version     = "5.31.0"`,
        `+  version     = "5.32.0"`,
        ` }`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "infra/prod/.terraform.lock.hcl", patch },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].ecosystem).toBe("terraform");
    });

    it("handles provider block where context line is in different hunk from version line", () => {
      const patch = [
        ` provider "registry.terraform.io/hashicorp/aws" {`,
        `-  version     = "5.40.0"`,
        `+  version     = "5.50.0"`,
        `   constraints = ">= 5.0.0"`,
        ` }`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl", patch },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "registry.terraform.io/hashicorp/aws",
        fromVersion: "5.40.0",
        toVersion: "5.50.0",
        ecosystem: "terraform",
      });
    });

    it("ignores files without a patch", () => {
      const result = parseDependencyChanges("", [
        { filename: ".terraform.lock.hcl" },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe("npm", () => {
    it("detects a package version change in package.json", () => {
      const patch = [
        `-    "axios": "^1.6.0"`,
        `+    "axios": "^2.0.0"`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "package.json", patch },
      ]);

      expect(result).toEqual([
        {
          name: "axios",
          fromVersion: "1.6.0",
          toVersion: "2.0.0",
          ecosystem: "npm",
        },
      ]);
    });
  });

  describe("pip", () => {
    it("detects version changes in requirements.txt", () => {
      const patch = [
        `-django==3.2.0`,
        `+django==4.2.0`,
        ` requests==2.28.1`,
        `-flask==2.0.1`,
        `+flask==2.3.0`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "requirements.txt", patch },
      ]);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        name: "django",
        fromVersion: "3.2.0",
        toVersion: "4.2.0",
        ecosystem: "pip",
      });
      expect(result).toContainEqual({
        name: "flask",
        fromVersion: "2.0.1",
        toVersion: "2.3.0",
        ecosystem: "pip",
      });
    });
  });

  describe("go", () => {
    it("detects version changes in go.mod", () => {
      const patch = [
        ` require (`,
        `-    github.com/gin-gonic/gin v1.9.0`,
        `+    github.com/gin-gonic/gin v1.10.0`,
        `     github.com/stretchr/testify v1.8.4`,
        ` )`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "go.mod", patch },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "github.com/gin-gonic/gin",
        fromVersion: "1.9.0",
        toVersion: "1.10.0",
        ecosystem: "go",
      });
    });
  });

  describe("composer", () => {
    it("detects a package version change in composer.json", () => {
      const patch = [
        `-    "symfony/console": "^6.3"`,
        `+    "symfony/console": "^7.0"`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "composer.json", patch },
      ]);

      expect(result).toEqual([
        {
          name: "symfony/console",
          fromVersion: "6.3",
          toVersion: "7.0",
          ecosystem: "composer",
        },
      ]);
    });

    it("detects version changes in composer.lock", () => {
      const patch = [
        `-            "name": "symfony/console",`,
        `-            "version": "v6.3.12",`,
        `+            "name": "symfony/console",`,
        `+            "version": "v7.0.4",`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "composer.lock", patch },
      ]);

      expect(result).toEqual([
        {
          name: "symfony/console",
          fromVersion: "6.3.12",
          toVersion: "7.0.4",
          ecosystem: "composer",
        },
      ]);
    });

    it("ignores unchanged versions in composer.json", () => {
      const patch = [
        `     "symfony/console": "^6.3"`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "composer.json", patch },
      ]);

      expect(result).toEqual([]);
    });

    it("detects multiple changes in composer.lock", () => {
      const patch = [
        `-            "name": "symfony/console",`,
        `-            "version": "v6.3.12",`,
        `+            "name": "symfony/console",`,
        `+            "version": "v7.0.4",`,
        `-            "name": "guzzlehttp/guzzle",`,
        `-            "version": "7.5.0",`,
        `+            "name": "guzzlehttp/guzzle",`,
        `+            "version": "7.8.1",`,
      ].join("\n");

      const result = parseDependencyChanges("", [
        { filename: "composer.lock", patch },
      ]);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        name: "symfony/console",
        fromVersion: "6.3.12",
        toVersion: "7.0.4",
        ecosystem: "composer",
      });
      expect(result).toContainEqual({
        name: "guzzlehttp/guzzle",
        fromVersion: "7.5.0",
        toVersion: "7.8.1",
        ecosystem: "composer",
      });
    });
  });

  it("returns empty array when changes are not dependency-related", () => {
    const patch = [
      `-  "name": "my-app",`,
      `+  "name": "my-awesome-app",`,
      `   "version": "1.0.0"`,
    ].join("\n");

    const result = parseDependencyChanges("", [
      { filename: "package.json", patch },
    ]);

    expect(result).toHaveLength(0);
  });
});

describe("getImportPatterns", () => {
  describe("terraform", () => {
    it("extracts short name from full registry path", () => {
      const patterns = getImportPatterns(
        "registry.terraform.io/hashicorp/aws",
        "terraform",
      );

      expect(patterns).toContain(`resource "aws_`);
      expect(patterns).toContain(`data "aws_`);
      expect(patterns).toContain(`provider "aws"`);
    });

    it("extracts short name from org/name path", () => {
      const patterns = getImportPatterns("hashicorp/google", "terraform");

      expect(patterns).toContain(`resource "google_`);
      expect(patterns).toContain(`data "google_`);
      expect(patterns).toContain(`provider "google"`);
    });

    it("does not include module pattern", () => {
      const patterns = getImportPatterns(
        "registry.terraform.io/hashicorp/aws",
        "terraform",
      );

      expect(patterns.some((p) => p.startsWith("module"))).toBe(false);
    });
  });

  describe("npm", () => {
    it("returns import and require patterns", () => {
      const patterns = getImportPatterns("axios", "npm");

      expect(patterns).toContain(`from "axios"`);
      expect(patterns).toContain(`require("axios")`);
    });
  });

  describe("pip", () => {
    it("returns import and from patterns", () => {
      const patterns = getImportPatterns("django", "pip");

      expect(patterns.some((p) => p.includes("import django"))).toBe(true);
      expect(patterns.some((p) => p.includes("from django"))).toBe(true);
    });
  });

  describe("go", () => {
    it("returns quoted import patterns", () => {
      const patterns = getImportPatterns("github.com/gin-gonic/gin", "go");

      expect(patterns.some((p) => p.includes('"github.com/gin-gonic/gin"'))).toBe(true);
    });
  });

  describe("composer", () => {
    it("returns PHP namespace use patterns", () => {
      const patterns = getImportPatterns("symfony/console", "composer");

      expect(patterns).toContain(`use Symfony\\Console\\`);
      expect(patterns).toContain(`use Symfony\\Console;`);
    });
  });

  describe("default", () => {
    it("returns dep name for unknown ecosystems", () => {
      const patterns = getImportPatterns("some-package", "unknown");

      expect(patterns).toContain("some-package");
    });
  });
});

describe("classifyUpgrade", () => {
  it("detects major upgrades", () => {
    expect(classifyUpgrade("1.6.0", "2.0.0")).toBe("major");
    expect(classifyUpgrade("6.3", "7.0")).toBe("major");
  });

  it("detects minor upgrades", () => {
    expect(classifyUpgrade("5.31.0", "5.32.0")).toBe("minor");
    expect(classifyUpgrade("1.9.0", "1.10.0")).toBe("minor");
  });

  it("detects patch upgrades", () => {
    expect(classifyUpgrade("5.31.0", "5.31.1")).toBe("patch");
    expect(classifyUpgrade("7.5.0", "7.5.3")).toBe("patch");
  });

  it("returns unknown for non-semver strings", () => {
    expect(classifyUpgrade("abc", "def")).toBe("unknown");
  });

  it("handles two-segment versions", () => {
    expect(classifyUpgrade("1.0", "1.1")).toBe("minor");
    expect(classifyUpgrade("1.0", "2.0")).toBe("major");
  });
});

describe("findDepLineInPatch", () => {
  it("finds the line number for an added dependency", () => {
    const patch = [
      `@@ -10,3 +10,3 @@`,
      `     "lodash": "^4.17.0",`,
      `-    "axios": "^1.6.0"`,
      `+    "axios": "^2.0.0"`,
    ].join("\n");

    expect(findDepLineInPatch(patch, "axios")).toBe(11);
  });

  it("returns null when dependency is not in an added line", () => {
    const patch = [
      `@@ -10,3 +10,3 @@`,
      `     "lodash": "^4.17.0",`,
      `     "axios": "^1.6.0"`,
    ].join("\n");

    expect(findDepLineInPatch(patch, "axios")).toBeNull();
  });

  it("handles multiple hunks", () => {
    const patch = [
      `@@ -1,3 +1,3 @@`,
      `     "a": "1.0.0",`,
      `@@ -20,3 +20,3 @@`,
      `     "b": "2.0.0",`,
      `-    "target": "^1.0.0"`,
      `+    "target": "^2.0.0"`,
    ].join("\n");

    expect(findDepLineInPatch(patch, "target")).toBe(21);
  });

  it("does not match a dep name that is a prefix of another dep name", () => {
    const patch = [
      `@@ -10,3 +10,3 @@`,
      `-    "aws-sdk": "^2.0.0"`,
      `+    "aws-sdk": "^3.0.0"`,
    ].join("\n");

    expect(findDepLineInPatch(patch, "aws")).toBeNull();
  });

  it("skips the no-newline-at-end-of-file marker when counting lines", () => {
    const patch = [
      `@@ -10,3 +10,3 @@`,
      `     "lodash": "^4.17.0",`,
      `-    "axios": "^1.6.0"`,
      `\\ No newline at end of file`,
      `+    "axios": "^2.0.0"`,
    ].join("\n");

    expect(findDepLineInPatch(patch, "axios")).toBe(11);
  });
});

describe("extractDependabotSection", () => {
  const groupBody = [
    "Bumps the deps group with 2 updates.",
    "",
    '<details><summary>Release notes for axios</summary>',
    "<p>Release v2.0.0 - Breaking changes</p>",
    "</details>",
    "",
    '<details><summary>Release notes for lodash</summary>',
    "<p>v4.17.21 - Security fix</p>",
    "</details>",
  ].join("\n");

  it("extracts only the matching details block for a dependency", () => {
    const section = extractDependabotSection(groupBody, "axios");
    expect(section).toContain("axios");
    expect(section).toContain("Release v2.0.0");
    expect(section).not.toContain("lodash");
  });

  it("extracts the other dependency independently", () => {
    const section = extractDependabotSection(groupBody, "lodash");
    expect(section).toContain("lodash");
    expect(section).toContain("Security fix");
    expect(section).not.toContain("axios");
  });

  it("returns the full body when no details blocks exist", () => {
    const plain = "Just a simple PR body with no HTML blocks.";
    expect(extractDependabotSection(plain, "axios")).toBe(plain);
  });

  it("returns the full body when no details block mentions the dep", () => {
    const unrelated = [
      "<details><summary>Notes for react</summary>",
      "<p>Some react notes</p>",
      "</details>",
    ].join("\n");
    expect(extractDependabotSection(unrelated, "axios")).toBe(unrelated);
  });

  it("returns multiple matching blocks if dep appears in more than one", () => {
    const body = [
      '<details><summary>Release notes for axios</summary>',
      "<p>Release notes here</p>",
      "</details>",
      '<details><summary>Changelog for axios</summary>',
      "<p>Changelog entries</p>",
      "</details>",
      '<details><summary>Commits for lodash</summary>',
      "<p>Commit list</p>",
      "</details>",
    ].join("\n");

    const section = extractDependabotSection(body, "axios");
    expect(section).toContain("Release notes here");
    expect(section).toContain("Changelog entries");
    expect(section).not.toContain("lodash");
  });
});
