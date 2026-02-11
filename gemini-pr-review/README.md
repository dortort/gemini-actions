# Gemini PR Review

Performs an automated code review on an open pull request using Gemini. Posts inline comments on specific lines and a summary review comment.

Get an immediate first-pass review on every PR. Catches common issues (security concerns, style violations, potential bugs) before a human reviewer looks at it.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `pr_number` | The pull request number to review | Yes | |
| `review_strictness` | Review strictness level: `low`, `medium`, or `high` | No | `medium` |
| `gemini_api_key` | Google Gemini API key | Yes | |
| `github_token` | GitHub token with repo write access | Yes | |
| `model` | Gemini model to use | No | `gemini-2.0-flash` |

### Strictness levels

- **low** — Only critical issues: security vulnerabilities, data loss risks, and clear bugs
- **medium** — Bugs, security, performance, and significant design concerns
- **high** — Thorough review including edge cases, naming conventions, and code style

## Usage

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/gemini-pr-review@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
          review_strictness: medium
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Fetches the PR title, description, and all file diffs
2. Truncates diffs to stay within token limits (10K chars/file, 200K total)
3. Asks Gemini to review with the specified strictness level
4. Parses structured comments from the response
5. Posts a GitHub review with inline comments and a summary
