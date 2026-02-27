export interface DependencyChange {
  name: string;
  fromVersion: string;
  toVersion: string;
  ecosystem: string;
}

/**
 * Parse diff lines to collect added/removed values, then emit changes where the
 * version actually changed. This pattern was previously duplicated for every
 * ecosystem — now it lives in one place.
 */
function collectVersionChanges(
  patch: string,
  regex: RegExp,
  ecosystem: string,
): DependencyChange[] {
  const removed = new Map<string, string>();
  const added = new Map<string, string>();

  for (const line of patch.split("\n")) {
    const match = line.match(regex);
    if (match) {
      if (match[1] === "-") removed.set(match[2], match[3]);
      else added.set(match[2], match[3]);
    }
  }

  const changes: DependencyChange[] = [];
  for (const [name, toVersion] of added) {
    const fromVersion = removed.get(name);
    if (fromVersion && fromVersion !== toVersion) {
      changes.push({ name, fromVersion, toVersion, ecosystem });
    }
  }
  return changes;
}

export function parseDependencyChanges(diff: string, files: { filename: string; patch?: string }[]): DependencyChange[] {
  const changes: DependencyChange[] = [];

  for (const file of files) {
    if (!file.patch) continue;

    // npm: package.json / package-lock.json
    if (file.filename.endsWith("package.json") || file.filename.endsWith("package-lock.json")) {
      changes.push(
        ...collectVersionChanges(
          file.patch,
          /^([-+])\s*"([^"]+)":\s*"[~^]?(\d+[^"]*)"/,
          "npm",
        ),
      );
    }

    // Composer: composer.json
    if (file.filename.endsWith("composer.json")) {
      changes.push(
        ...collectVersionChanges(
          file.patch,
          /^([-+])\s*"([^"]+\/[^"]+)":\s*"[~^]?(\d+[^"]*)"/,
          "composer",
        ),
      );
    }

    // Composer: composer.lock (name and version on separate lines)
    if (file.filename.endsWith("composer.lock")) {
      const removed = new Map<string, string>();
      const added = new Map<string, string>();
      let removedName = "";
      let addedName = "";

      for (const line of file.patch.split("\n")) {
        const nameMatch = line.match(/^([-+])\s*"name":\s*"([^"]+)"/);
        if (nameMatch) {
          if (nameMatch[1] === "-") removedName = nameMatch[2];
          else addedName = nameMatch[2];
        }

        const versionMatch = line.match(/^([-+])\s*"version":\s*"v?(\d+[^"]*)"/);
        if (versionMatch) {
          if (versionMatch[1] === "-") {
            removed.set(removedName, versionMatch[2]);
          } else {
            added.set(addedName, versionMatch[2]);
          }
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "composer" });
        }
      }
    }

    // Python: requirements.txt / Pipfile
    if (file.filename.endsWith("requirements.txt") || file.filename.endsWith("Pipfile")) {
      changes.push(
        ...collectVersionChanges(
          file.patch,
          /^([-+])([a-zA-Z0-9_-]+)[=<>~!]+(\d+\S*)/,
          "pip",
        ),
      );
    }

    // Go: go.mod
    if (file.filename === "go.mod") {
      changes.push(
        ...collectVersionChanges(
          file.patch,
          /^([-+])\s*(\S+)\s+v(\S+)/,
          "go",
        ),
      );
    }

    // Terraform: .terraform.lock.hcl (provider + version on separate lines)
    if (file.filename.endsWith(".terraform.lock.hcl")) {
      let currentProvider = "";
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const providerMatch = line.match(/^[ +-]\s*provider\s+"([^"]+)"/);
        if (providerMatch) {
          currentProvider = providerMatch[1];
        }

        const versionMatch = line.match(/^([-+])\s*version\s*=\s*"(\d+\S*)"/);
        if (versionMatch && currentProvider) {
          if (versionMatch[1] === "-") removed.set(currentProvider, versionMatch[2]);
          else added.set(currentProvider, versionMatch[2]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "terraform" });
        }
      }
    }
  }

  return changes;
}

import { UpgradeType } from "./types";

/**
 * Classify a version change as major, minor, patch, or unknown.
 */
export function classifyUpgrade(from: string, to: string): UpgradeType {
  const parseSemver = (v: string): [number, number, number] | null => {
    const match = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) return null;
    return [
      parseInt(match[1], 10),
      parseInt(match[2] ?? "0", 10),
      parseInt(match[3] ?? "0", 10),
    ];
  };

  const fromParts = parseSemver(from);
  const toParts = parseSemver(to);
  if (!fromParts || !toParts) return "unknown";

  if (toParts[0] !== fromParts[0]) return "major";
  if (toParts[1] !== fromParts[1]) return "minor";
  return "patch";
}

/**
 * Find the line number in the new file where a dependency's version appears as
 * an added line in a diff patch. Returns null if not found.
 */
export function findDepLineInPatch(patch: string, depName: string): number | null {
  let lineNum = 0;
  const escaped = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Require exact word boundary: dep name must not be preceded or followed by
  // a character that is valid in a package name (alphanumeric, _, ., /, @, -)
  // so that e.g. "aws" does not match "aws-sdk".
  const depPattern = new RegExp(`(?<![\\w./@\\-])${escaped}(?![\\w./@\\-])`);

  for (const raw of patch.split("\n")) {
    const hunkMatch = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunkMatch) {
      lineNum = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }
    // Skip removed lines and the "\ No newline at end of file" diff marker
    if (raw.startsWith("-") || raw.startsWith("\\")) continue;
    lineNum++;
    if (raw.startsWith("+") && depPattern.test(raw)) {
      return lineNum;
    }
  }
  return null;
}

export function getImportPatterns(depName: string, ecosystem: string): string[] {
  switch (ecosystem) {
    case "npm":
      return [
        `from "${depName}"`,
        `from '${depName}'`,
        `require("${depName}")`,
        `require('${depName}')`,
        `from "${depName}/`,
        `from '${depName}/`,
      ];
    case "pip":
      return [`import ${depName}`, `from ${depName}`];
    case "go":
      return [`"${depName}"`, `"${depName}/`];
    case "terraform": {
      // Extract short provider name from registry path
      // e.g. "registry.terraform.io/hashicorp/aws" -> "aws"
      const shortName = depName.split("/").pop() || depName;
      return [
        `resource "${shortName}_`,
        `data "${shortName}_`,
        `provider "${shortName}"`,
      ];
    }
    case "composer": {
      // Convert vendor/package to PascalCase namespace
      // e.g., "symfony/console" -> "Symfony\\Console"
      const namespace = depName
        .split("/")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("\\");
      return [`use ${namespace}\\`, `use ${namespace};`];
    }
    default:
      return [depName];
  }
}

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
export function extractDependabotSection(body: string, depName: string): string {
  // Match all <details>…</details> blocks (non-greedy, case-insensitive tags)
  const detailsBlocks = body.match(/<details[\s\S]*?<\/details>/gi);
  if (!detailsBlocks || detailsBlocks.length === 0) return body;

  const escaped = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const depBoundaryRe = new RegExp(`(?<![\\w./@\\-])${escaped}(?![\\w./@\\-])`);
  const matching = detailsBlocks.filter((block) => depBoundaryRe.test(block));
  if (matching.length === 0) return body;

  return matching.join("\n\n");
}
