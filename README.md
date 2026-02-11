# Gemini Actions

A collection of GitHub Actions powered by [Google Gemini](https://ai.google.dev/) that automate repository workflows. Each action leverages Gemini's capabilities to analyze context, make decisions, and take meaningful actions on your repositories.

## Actions

| Action | Description |
|--------|-------------|
| [gemini-pr-from-issue](gemini-pr-from-issue/) | Reads an issue, generates a code change, and opens a pull request |
| [gemini-pr-review](gemini-pr-review/) | Automated code review with inline comments and configurable strictness |
| [gemini-dependency-impact](gemini-dependency-impact/) | Analyzes dependency update PRs against actual codebase usage |
| [gemini-test-failure-diagnosis](gemini-test-failure-diagnosis/) | Diagnoses CI test failures by linking PR changes to broken tests |
| [gemini-datadog-responder](gemini-datadog-responder/) | Interprets Datadog alerts and takes repository actions |
| [gemini-repo-qa](gemini-repo-qa/) | Answers codebase questions in Issues or Discussions with source references |

## Contributing

Contributions are welcome. This project follows the [Conventional Commits](https://www.conventionalcommits.org/) standard.

### CI/CD

- **CI** — Runs on every push and pull request. Builds all affected actions using [Nx](https://nx.dev/).
- **Release** — Triggered by tags following semver (e.g., `v1.0.0` or `gemini-pr-review/v1.2.0`). Builds and publishes the affected actions to the GitHub Marketplace.

### Adding a new action

1. Create a new directory at the repository root (prefix with `gemini-`)
2. Add an `action.yml` defining inputs, outputs, and the runtime
3. Implement the action in `src/`
4. Add a `README.md` with description, inputs, outputs, and usage examples
5. Register the workspace in the root `package.json`
6. Open a PR

## License

[MIT](LICENSE)
