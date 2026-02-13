import { describe, it, expect } from "vitest";
import { parseDependencyChanges, getImportPatterns } from "./parsers";

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
});
