# Gemini Actions

[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Gemini%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/gemini-actions)
[![CI](https://github.com/dortort/gemini-actions/actions/workflows/ci.yml/badge.svg)](https://github.com/dortort/gemini-actions/actions/workflows/ci.yml)
[![Release](https://github.com/dortort/gemini-actions/actions/workflows/release.yml/badge.svg)](https://github.com/dortort/gemini-actions/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Nx](https://img.shields.io/badge/Nx-22-143055?logo=nx&logoColor=white)](https://nx.dev/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-API-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)

A collection of GitHub Actions powered by [Google Gemini](https://ai.google.dev/) that automate repository workflows. Each action leverages Gemini's capabilities to analyze context, make decisions, and take meaningful actions on your repositories.

## Quick Start

> [!NOTE]
> This repository is a **collection of sub-actions**, not a single runnable root action. Invoke individual actions by sub-path (`dortort/gemini-actions/<action>@v0`) rather than `dortort/gemini-actions@v0`.

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and save it as a repository secret named `GEMINI_API_KEY`.
2. Add a workflow file referencing the sub-action you want — for example, `.github/workflows/pr-review.yml` for automated PR reviews:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/pr-review@v0
        with:
          pr_number: ${{ github.event.pull_request.number }}
          review_strictness: medium
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

See the individual action docs below for triggers, inputs, outputs, and workflow examples for each sub-action.

## Actions

| Action | Workflow reference | Description |
|--------|--------------------|-------------|
| **[pr-review](pr-review/)** | `dortort/gemini-actions/pr-review@v0` | Automated code review with inline comments and configurable strictness. |
| **[dependency-impact](dependency-impact/)** | `dortort/gemini-actions/dependency-impact@v0` | Analyzes dependency update PRs against actual codebase usage. |
| **[pr-from-issue](pr-from-issue/)** | `dortort/gemini-actions/pr-from-issue@v0` | Reads an issue, generates a code change, and opens a pull request. |
| **[test-failure-diagnosis](test-failure-diagnosis/)** | `dortort/gemini-actions/test-failure-diagnosis@v0` | Diagnoses CI test failures by linking PR changes to broken tests. |
| **[datadog-responder](datadog-responder/)** | `dortort/gemini-actions/datadog-responder@v0` | Interprets Datadog alerts and takes repository actions. |
| **[repo-qa](repo-qa/)** | `dortort/gemini-actions/repo-qa@v0` | Answers codebase questions in Issues or Discussions with source references. |

## Contributing

Contributions are welcome. This project follows the [Conventional Commits](https://www.conventionalcommits.org/) standard.

### CI/CD

- **CI** — Runs on every push and pull request. Builds all affected actions using [Nx](https://nx.dev/).
- **Release** — Triggered by tags following semver (e.g., `v1.0.0` or `pr-review/v1.2.0`). Builds and publishes the affected actions to the GitHub Marketplace.

### Adding a new action

1. Create a new directory at the repository root
2. Add an `action.yml` defining inputs, outputs, and the runtime
3. Implement the action in `src/`
4. Add a `README.md` with description, inputs, outputs, and usage examples
5. Register the workspace in the root `package.json`
6. Open a PR

## License

[MIT](LICENSE)
