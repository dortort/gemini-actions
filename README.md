# Gemini Actions

A collection of GitHub Actions powered by [Google Gemini](https://ai.google.dev/) that automate repository workflows. Each action leverages Gemini's capabilities to analyze context, make decisions, and take meaningful actions on your repositories — from opening pull requests to triaging issues to reacting to signals from third-party services.

## Actions

### Planned First Batch

#### `gemini-pr-from-issue`

Reads a GitHub issue, analyzes the request using Gemini, generates a code change, and opens a pull request that addresses it.

**Use case:** A product manager files an issue describing a copy change, config update, or small feature. This action picks it up, produces the change, and opens a PR for review — no developer context-switch required.

**Inputs:**
- `issue_number` — The issue to process
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

---

#### `gemini-pr-review`

Performs an automated code review on an open pull request using Gemini. Posts inline comments on specific lines and a summary review comment.

**Use case:** Get an immediate first-pass review on every PR. Catches common issues (security concerns, style violations, potential bugs) before a human reviewer looks at it.

**Inputs:**
- `pr_number` — The pull request to review
- `review_strictness` — `low`, `medium`, or `high`
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

---

#### `gemini-issue-triage`

Automatically labels, assigns, and prioritizes new issues using Gemini. Analyzes the issue title, body, and repository context to determine the appropriate labels and assignees.

**Use case:** Incoming issues in a busy repo get categorized instantly — labeled by area (`frontend`, `backend`, `infra`), tagged by type (`bug`, `feature`, `question`), and assigned to the right team member.

**Inputs:**
- `issue_number` — The issue to triage
- `label_set` — JSON array of available labels and their descriptions
- `assignee_map` — JSON map of areas to default assignees
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

---

#### `gemini-release-notes`

Generates release notes from merged pull requests between two refs. Uses Gemini to summarize changes into user-facing language grouped by category.

**Use case:** Cut a release and get a polished changelog without manually reviewing every merged PR. The output is written to a GitHub Release or committed as a `CHANGELOG` entry.

**Inputs:**
- `base_ref` — Starting ref (e.g., previous tag)
- `head_ref` — Ending ref (e.g., `main`)
- `output` — `release` or `changelog`
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

---

#### `gemini-datadog-responder`

Queries Datadog for alerts, anomalies, or metric thresholds, then uses Gemini to interpret the results and take action on the repository — such as opening an issue, commenting on a related PR, or triggering a rollback workflow.

**Use case:** A Datadog monitor fires for elevated error rates after a deployment. This action fetches the relevant metrics, correlates them with recent merges, and opens an issue linking the suspected PR with supporting data.

**Inputs:**
- `datadog_api_key` — Datadog API key
- `datadog_app_key` — Datadog application key
- `query` — Datadog metrics query or monitor ID
- `action` — `open_issue`, `comment_on_pr`, or `trigger_workflow`
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

---

#### `gemini-stale-pr-nudge`

Scans for pull requests that have gone stale (no activity for a configurable period), uses Gemini to summarize the current state of each PR, and posts a comment nudging the author or reviewers to take action.

**Use case:** PRs that go dormant get a friendly, context-aware nudge instead of a generic bot message. Gemini reads the PR diff and review threads to generate a useful summary of what's blocking progress.

**Inputs:**
- `stale_days` — Number of days of inactivity before a PR is considered stale
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

## Usage

Each action is published independently on the GitHub Marketplace. Use them in your workflows like any other action:

```yaml
name: Triage new issues
on:
  issues:
    types: [opened]

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: dortort/gemini-actions/gemini-issue-triage@v1
        with:
          issue_number: ${{ github.event.issue.number }}
          label_set: '[{"name": "bug", "description": "Something is broken"}]'
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Repository Structure

```
gemini-actions/
├── gemini-pr-from-issue/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── gemini-pr-review/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── gemini-issue-triage/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── ...
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
└── README.md
```

Each action lives in its own directory with its own `action.yml`, source code, and dependencies. This allows independent versioning and publishing while sharing a single repository.

## Contributing

Contributions are welcome. Please follow these guidelines.

### Development Model

This project uses **trunk-based development**. All work targets the `main` branch:

- Create short-lived feature branches off `main`
- Keep branches small and focused — ideally a single action or a single concern
- Merge back into `main` as soon as the change is ready and reviewed
- No long-lived feature branches

### Commit Convention

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` — A new feature or action
- `fix` — A bug fix
- `docs` — Documentation changes
- `refactor` — Code restructuring without behavior change
- `test` — Adding or updating tests
- `ci` — Changes to CI/CD configuration
- `chore` — Maintenance tasks (dependency updates, tooling)

**Scope** should be the action name when the change targets a specific action:

```
feat(gemini-pr-review): add support for review strictness levels
fix(gemini-datadog-responder): handle empty metric responses
ci: add release workflow for marketplace publishing
```

### CI/CD

GitHub Actions powers the CI/CD pipeline for this repository:

- **CI** — Runs on every push and pull request. Lints, tests, and builds all affected actions. Only actions with changes in their directory are tested to keep feedback fast.
- **Release** — Triggered by tags following semver (e.g., `v1.0.0`). Builds and publishes the affected actions to the GitHub Marketplace. Each action is versioned independently using scoped tags (e.g., `gemini-pr-review/v1.2.0`).

### Pull Request Process

1. Fork the repository and create a branch off `main`
2. Make your changes, following the commit convention above
3. Ensure all CI checks pass
4. Open a pull request with a clear description of the change
5. A maintainer will review and merge

### Adding a New Action

1. Create a new directory at the repository root named after your action (prefix with `gemini-`)
2. Add an `action.yml` defining inputs, outputs, and the runtime
3. Implement the action in `src/`
4. Add tests
5. Update this README with the action's description and inputs
6. Open a PR

## License

[MIT](LICENSE)
