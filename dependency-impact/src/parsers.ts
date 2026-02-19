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
