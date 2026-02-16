# Gemini Dependency Impact

Analyzes dependency update PRs by reading changelogs and cross-referencing usage in the codebase. Posts a comment summarizing the real impact: which of your files use changed APIs, whether breaking changes affect you, and what migration steps are needed.

Renovate opens a PR bumping `axios` from v1 to v2. Instead of a developer manually reading the migration guide and grepping the codebase, Gemini reports: "You call `axios.create()` with `cancelToken` in 3 files — this API was removed in v2. Switch to `AbortController`. All other usage is compatible."

Deterministic tools can tell you a major version changed. Only an LLM can read a changelog written in prose, understand which breaking changes are relevant to your specific usage patterns, and produce actionable migration guidance.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `pr_number` | The dependency update PR number to analyze | Yes | |
| `gemini_api_key` | Google Gemini API key | Yes | |
| `github_token` | GitHub token with repo write access | Yes | |
| `model` | Gemini model to use | No | `gemini-2.0-flash` |

### Supported ecosystems

- **npm** — `package.json` / `package-lock.json`
- **pip** — `requirements.txt` / `Pipfile`
- **Go** — `go.mod`
- **Terraform** — `.terraform.lock.hcl`

## Usage

```yaml
name: Dependency impact analysis
on:
  pull_request:
    types: [opened]
    paths:
      - "package.json"
      - "package-lock.json"
      - "requirements.txt"
      - "go.mod"
      - ".terraform.lock.hcl"

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/dependency-impact@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Fetches the PR diff and parses dependency version changes from lock files and manifests
2. Scans source files (up to 100) for imports of the changed dependencies
3. Fetches release notes using a layered approach:
   - For bot PRs (Dependabot, Renovate) with a populated body, uses the PR body directly — these bots already aggregate changelogs between versions
   - Otherwise, tries the GitHub Releases API for dependencies with resolvable repos (Go modules, Terraform providers)
   - Falls back to the PR body if GitHub Releases yields nothing
4. Sends a tailored prompt to Gemini depending on whether usage was found:
   - **With usage**: cross-references release notes against actual code. Reports only confirmed breaking changes, required actions, and risk
   - **Without usage**: summarizes release notes highlights. No fabricated impact analysis
5. Posts the analysis as a PR comment

## Release notes sourcing

The action needs real release notes to produce useful output — without them, any LLM will fill the gap with speculation. Release notes are resolved in priority order:

| Priority | Source | When used |
|----------|--------|-----------|
| 1 | PR body | PR author is a bot (`[bot]` suffix) and body has meaningful content (>50 chars) |
| 2 | GitHub Releases API | Dependency maps to a GitHub repo (Go modules via path, Terraform providers via registry convention) |
| 3 | PR body (fallback) | GitHub Releases returned nothing but the PR body has content |

npm and pip packages cannot currently be resolved to GitHub repos automatically. For these ecosystems, release notes come from the PR body or are reported as unavailable.
