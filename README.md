# Gemini Actions

A collection of GitHub Actions powered by [Google Gemini](https://ai.google.dev/) that automate repository workflows. Each action leverages Gemini's capabilities to analyze context, make decisions, and take meaningful actions on your repositories — from opening pull requests to triaging issues to reacting to signals from third-party services.

## Actions

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

#### `gemini-dependency-impact`

When a dependency update PR is opened (by Dependabot, Renovate, or manually), Gemini reads the dependency's changelog and breaking change notes, then cross-references them against your actual usage of that dependency in the codebase. Posts a comment summarizing the real impact: which of your files use changed APIs, whether breaking changes affect you, and what migration steps are needed.

**Use case:** Renovate opens a PR bumping `axios` from v1 to v2. Instead of a developer manually reading the migration guide and grepping the codebase, Gemini reports: "You call `axios.create()` with `cancelToken` in 3 files — this API was removed in v2. Switch to `AbortController`. All other usage is compatible."

**Why Gemini:** Deterministic tools can tell you a major version changed. Only an LLM can read a changelog written in prose, understand which breaking changes are relevant to your specific usage patterns, and produce actionable migration guidance.

**Inputs:**
- `pr_number` — The dependency update PR to analyze
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

---

#### `gemini-test-failure-diagnosis`

When CI tests fail on a pull request, Gemini reads the test output, the failing test source code, and the PR diff to explain the causal link between the change and the failure. Posts a comment with a diagnosis and a suggested fix.

**Use case:** A PR touches a validation function and 4 tests fail. Instead of the developer reading raw test output and tracing the failure back to their change, Gemini reports: "Your change to `validateEmail()` now rejects `+` characters in the local part. Tests `test_plus_addressing`, `test_subaddress_gmail`, and 2 others use addresses with `+` and now fail. Either update the regex to allow `+` or update the test fixtures."

**Why Gemini:** Deterministic CI shows you _that_ a test failed and the stack trace. Only an LLM can read the diff, read the test, and explain _why_ the change caused the failure — bridging the semantic gap between "what you changed" and "what broke."

**Inputs:**
- `pr_number` — The PR with failing tests
- `test_output` — Path or artifact name containing the test output
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

#### `gemini-repo-qa`

Enables a conversational Q&A interface within GitHub Issues or Discussions. When a user posts a question (triggered by a label, keyword, or discussion category), Gemini reads the relevant source files in the repository to produce a grounded answer with file references.

**Use case:** A new contributor opens an issue asking "How does the authentication middleware work?" Gemini reads the middleware source, the route definitions, and the auth config, then replies with an explanation referencing specific files and line numbers — a response that would otherwise require a senior engineer's time.

**Why Gemini:** No deterministic tool can answer open-ended questions about code. This requires reading source files, understanding their relationships, and producing a natural language explanation. Search tools can find files; only an LLM can explain what they do and how they connect.

**Inputs:**
- `issue_number` or `discussion_id` — The question to answer
- `source_paths` — Directories or globs to include as context (e.g., `src/**`)
- `gemini_api_key` — Google Gemini API key
- `github_token` — Token with repo write access

## Usage

Each action is published independently on the GitHub Marketplace. Use them in your workflows like any other action:

```yaml
name: Diagnose test failures
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  diagnose:
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/gemini-test-failure-diagnosis@v1
        with:
          pr_number: ${{ github.event.workflow_run.pull_requests[0].number }}
          test_output: test-results/output.log
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
├── gemini-dependency-impact/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── gemini-test-failure-diagnosis/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── gemini-datadog-responder/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── gemini-repo-qa/
│   ├── action.yml
│   ├── src/
│   └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
└── README.md
```

Each action lives in its own directory with its own `action.yml`, source code, and dependencies. This allows independent versioning and publishing while sharing a single repository.

## Contributing

Contributions are welcome. See [CLAUDE.md](CLAUDE.md) for development guidelines. This project follows the [Conventional Commits](https://www.conventionalcommits.org/) standard.

## License

[MIT](LICENSE)
