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

