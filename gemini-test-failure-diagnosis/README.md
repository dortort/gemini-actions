# Gemini Test Failure Diagnosis

Diagnoses CI test failures by analyzing test output, the failing test source code, and the PR diff. Posts a comment explaining the causal link between the change and the failure, with a suggested fix.

A PR touches a validation function and 4 tests fail. Instead of the developer reading raw test output and tracing the failure back to their change, Gemini reports: "Your change to `validateEmail()` now rejects `+` characters in the local part. Tests `test_plus_addressing`, `test_subaddress_gmail`, and 2 others use addresses with `+` and now fail. Either update the regex to allow `+` or update the test fixtures."

Deterministic CI shows you _that_ a test failed and the stack trace. Only an LLM can read the diff, read the test, and explain _why_ the change caused the failure — bridging the semantic gap between "what you changed" and "what broke."

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `pr_number` | The PR number with failing tests | Yes | |
| `test_output` | Path or artifact name containing the test output | Yes | |
| `gemini_api_key` | Google Gemini API key | Yes | |
| `github_token` | GitHub token with repo write access | Yes | |
| `model` | Gemini model to use | No | `gemini-2.0-flash` |

## Usage

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

## How it works

1. Fetches the PR diff and file patches
2. Reads the test output file (truncated to 15K chars)
3. Extracts failing test file paths from the output (supports Jest, Vitest, pytest, Go)
4. Fetches the source code of up to 5 failing test files
5. Asks Gemini to diagnose the root cause, list affected tests, and suggest a fix
6. Posts the diagnosis as a PR comment
