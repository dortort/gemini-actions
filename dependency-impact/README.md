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

1. Fetches the PR diff and parses dependency version changes
2. Scans source files (up to 100) for imports of the changed dependencies
3. Extracts the relevant usage lines for context
4. Asks Gemini to analyze breaking changes, affected files, migration steps, and risk level
5. Posts the analysis as a PR comment
