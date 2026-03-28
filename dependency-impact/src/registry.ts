export type RegistryResolver = (dep: { name: string; ecosystem: string }) => Promise<{ owner: string; repo: string } | null>;

export function createRegistryResolver(
  fetchFn: typeof fetch = fetch,
): RegistryResolver {
  return async function resolveGitHubRepo(dep) {
    if (dep.ecosystem === "go" && dep.name.startsWith("github.com/")) {
      const parts = dep.name.replace("github.com/", "").split("/");
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    }
    if (dep.ecosystem === "terraform" && dep.name.startsWith("registry.terraform.io/")) {
      const parts = dep.name.replace("registry.terraform.io/", "").split("/");
      if (parts.length >= 2) return { owner: parts[0], repo: `terraform-provider-${parts[1]}` };
    }
    if (dep.ecosystem === "npm") {
      try {
        const res = await fetchFn(`https://registry.npmjs.org/${dep.name}`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const url = (data?.repository as Record<string, unknown>)?.url;
          if (typeof url === "string") {
            const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
            const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (match) return { owner: match[1], repo: match[2] };
          }
        }
      } catch {
        // Registry lookup failed
      }
    }
    if (dep.ecosystem === "composer") {
      try {
        const res = await fetchFn(`https://packagist.org/packages/${dep.name}.json`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const versions = (data?.package as Record<string, unknown>)?.versions as Record<string, Record<string, unknown>> | undefined;
          if (versions && typeof versions === "object") {
            const firstKey = Object.keys(versions)[0];
            const url = (versions[firstKey]?.source as Record<string, unknown>)?.url;
            if (typeof url === "string") {
              const cleaned = url.replace(/\.git$/, "");
              const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
              if (match) return { owner: match[1], repo: match[2] };
            }
          }
        }
      } catch {
        // Registry lookup failed
      }
    }
    return null;
  };
}
