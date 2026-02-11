# Gemini Datadog Responder

Queries Datadog for alerts, anomalies, or metric thresholds, then uses Gemini to interpret the results and take action on the repository — such as opening an issue, commenting on a related PR, or triggering a rollback workflow.

A Datadog monitor fires for elevated error rates after a deployment. This action fetches the relevant metrics, correlates them with recent merges, and opens an issue linking the suspected PR with supporting data.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `datadog_api_key` | Datadog API key | Yes | |
| `datadog_app_key` | Datadog application key | Yes | |
| `query` | Datadog metrics query or monitor ID | Yes | |
| `action` | Action to take: `open_issue`, `comment_on_pr`, or `trigger_workflow` | Yes | |
| `gemini_api_key` | Google Gemini API key | Yes | |
| `github_token` | GitHub token with repo write access | Yes | |
| `model` | Gemini model to use | No | `gemini-2.0-flash` |

### Actions

- **`open_issue`** — Creates a GitHub issue with the analysis
- **`comment_on_pr`** — Comments on the most recently updated open PR
- **`trigger_workflow`** — Dispatches a `datadog-alert` repository event (use with `repository_dispatch` trigger)

## Outputs

| Output | Description |
|--------|-------------|
| `result` | The action result (issue number, PR number, or `dispatch-sent`) |

## Usage

```yaml
name: Datadog alert responder
on:
  schedule:
    - cron: "*/15 * * * *"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/gemini-datadog-responder@v1
        with:
          datadog_api_key: ${{ secrets.DD_API_KEY }}
          datadog_app_key: ${{ secrets.DD_APP_KEY }}
          query: "avg:system.cpu.user{service:api}"
          action: open_issue
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Queries Datadog — detects whether the input is a monitor ID or a metrics query
2. Fetches the last 10 commits for correlation
3. Asks Gemini to analyze the data: status summary, commit correlation, severity, and recommended action
4. Takes the specified action (open issue, comment on PR, or dispatch event)
