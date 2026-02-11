# Development Guide

## Development Model

This project uses **trunk-based development**. All work targets the `main` branch:

- Create short-lived feature branches off `main`
- Keep branches small and focused — ideally a single action or a single concern
- Merge back into `main` as soon as the change is ready and reviewed
- No long-lived feature branches

## Commit Convention

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
feat(gemini-dependency-impact): detect renamed APIs in changelogs
ci: add release workflow for marketplace publishing
```

## CI/CD

GitHub Actions powers the CI/CD pipeline for this repository:

- **CI** — Runs on every push and pull request. Lints, tests, and builds all affected actions. Only actions with changes in their directory are tested to keep feedback fast.
- **Release** — Triggered by tags following semver (e.g., `v1.0.0`). Builds and publishes the affected actions to the GitHub Marketplace. Each action is versioned independently using scoped tags (e.g., `gemini-pr-review/v1.2.0`).

## Pull Request Process

1. Fork the repository and create a branch off `main`
2. Make your changes, following the commit convention above
3. Ensure all CI checks pass
4. Open a pull request with a clear description of the change
5. A maintainer will review and merge

## Adding a New Action

1. Create a new directory at the repository root named after your action (prefix with `gemini-`)
2. Add an `action.yml` defining inputs, outputs, and the runtime
3. Implement the action in `src/`
4. Add tests
5. Update the README with the action's description and inputs
6. Open a PR
