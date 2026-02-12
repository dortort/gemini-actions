# Gemini Repo QA

Conversational Q&A interface within GitHub Issues or Discussions powered by Gemini. When a user posts a question, Gemini reads the relevant source files in the repository and produces a grounded answer with file references.

A new contributor opens an issue asking "How does the authentication middleware work?" Gemini reads the middleware source, the route definitions, and the auth config, then replies with an explanation referencing specific files and line numbers — a response that would otherwise require a senior engineer's time.

No deterministic tool can answer open-ended questions about code. This requires reading source files, understanding their relationships, and producing a natural language explanation.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `issue_number` | The issue number containing the question (mutually exclusive with `discussion_id`) | No | |
| `discussion_id` | The discussion number containing the question (mutually exclusive with `issue_number`) | No | |
| `source_paths` | Directories or globs to include as context | No | `src/**` |
| `gemini_api_key` | Google Gemini API key | Yes | |
| `github_token` | GitHub token with repo write access | Yes | |
| `model` | Gemini model to use | No | `gemini-2.0-flash` |

> Either `issue_number` or `discussion_id` must be provided.

## Usage

### Triggered by issue label

```yaml
name: Answer questions
on:
  issues:
    types: [labeled]

jobs:
  answer:
    if: github.event.label.name == 'question'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/repo-qa@v1
        with:
          issue_number: ${{ github.event.issue.number }}
          source_paths: "src/**,lib/**"
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Triggered by discussion

```yaml
name: Answer discussions
on:
  discussion:
    types: [created]

jobs:
  answer:
    if: github.event.discussion.category.slug == 'q-a'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dortort/gemini-actions/repo-qa@v1
        with:
          discussion_id: ${{ github.event.discussion.number }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

1. Fetches the question from the issue or discussion
2. Gets the repository file tree, filtered by `source_paths` globs
3. Asks Gemini to identify the most relevant files (up to 20)
4. Fetches those files (truncated to 5K chars each)
5. Asks Gemini to answer the question with references to the source code
6. Posts the answer as a comment on the issue or discussion
