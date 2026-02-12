# Gemini PR from Issue

Reads a GitHub issue, analyzes the request using Gemini, generates a code change, and opens a pull request that addresses it.

A product manager files an issue describing a copy change, config update, or small feature. This action picks it up, produces the change, and opens a PR for review — no developer context-switch required.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `issue_number` | The issue number to process | Yes | |
| `gemini_api_key` | Google Gemini API key | Yes | |
| `github_token` | GitHub token with repo write access | Yes | |
| `model` | Gemini model to use | No | `gemini-2.0-flash` |

## Outputs

| Output | Description |
|--------|-------------|
| `pr_number` | The number of the created pull request |

## Usage

```yaml
name: Generate PR from issue
on:
  issues:
    types: [labeled]

jobs:
  generate:
    if: github.event.label.name == 'gemini'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/pr-from-issue@v1
        with:
          issue_number: ${{ github.event.issue.number }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Fetches the issue title and body
2. Gets the full repository file tree
3. Asks Gemini to identify which files are relevant to the issue
4. Fetches the content of those files (up to 20 files, 10K chars each)
5. Asks Gemini to generate the complete updated file contents
6. Creates a branch, commits the changes, and opens a pull request linking to the issue
