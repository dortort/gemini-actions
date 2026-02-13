export interface DependencyChange {
  name: string;
  fromVersion: string;
  toVersion: string;
  ecosystem: string;
}

export function parseDependencyChanges(diff: string, files: { filename: string; patch?: string }[]): DependencyChange[] {
  const changes: DependencyChange[] = [];

  for (const file of files) {
    if (!file.patch) continue;

    // Parse package.json changes (npm)
    if (file.filename.endsWith("package.json") || file.filename.endsWith("package-lock.json")) {
      const depRegex = /^[-+]\s*"([^"]+)":\s*"[^]*?(\d+\.\d+\.\d+[^"]*)"/gm;
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const match = line.match(/^([-+])\s*"([^"]+)":\s*"[~^]?(\d+[^"]*)"/)
        if (match) {
          if (match[1] === "-") removed.set(match[2], match[3]);
          else added.set(match[2], match[3]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "npm" });
        }
      }
    }

    // Parse requirements.txt changes (Python)
    if (file.filename.endsWith("requirements.txt") || file.filename.endsWith("Pipfile")) {
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const match = line.match(/^([-+])([a-zA-Z0-9_-]+)[=<>~!]+(\d+\S*)/);
        if (match) {
          if (match[1] === "-") removed.set(match[2], match[3]);
          else added.set(match[2], match[3]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "pip" });
        }
      }
    }

    // Parse go.mod changes (Go)
    if (file.filename === "go.mod") {
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        const match = line.match(/^([-+])\s*(\S+)\s+v(\S+)/);
        if (match) {
          if (match[1] === "-") removed.set(match[2], match[3]);
          else added.set(match[2], match[3]);
        }
      }

      for (const [name, toVersion] of added) {
        const fromVersion = removed.get(name);
        if (fromVersion && fromVersion !== toVersion) {
          changes.push({ name, fromVersion, toVersion, ecosystem: "go" });
        }
      }
    }

    // Parse .terraform.lock.hcl changes (Terraform)
    if (file.filename.endsWith(".terraform.lock.hcl")) {
      let currentProvider = "";
      const removed = new Map<string, string>();
      const added = new Map<string, string>();

      for (const line of file.patch.split("\n")) {
        // Track current provider from context, added, or removed lines
        const providerMatch = line.match(/^[ +-]\s*provider\s+"([^"]+)"/);
        if (providerMatch) {
          currentProvider = providerMatch[1];
        }

        // Extract pinned version
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
    default:
      return [depName];
  }
}
