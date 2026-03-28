import { truncateText, PullRequestInfo } from "@gemini-actions/shared";

export const STRICTNESS_PROMPTS: Record<string, string> = {
  low: "Focus only on critical issues: security vulnerabilities, data loss risks, and clear bugs. Ignore style, naming, and minor improvements.",
  medium:
    "Review for bugs, security issues, performance problems, and significant design concerns. Note style issues only if they hurt readability.",
  high: "Perform a thorough review covering bugs, security, performance, design, error handling, edge cases, naming conventions, and code style.",
};

export function buildFileSections(
  pr: PullRequestInfo,
  maxPatchPerFile: number = 10000,
  maxTotalDiff: number = 200000,
): string[] {
  let totalDiffChars = 0;
  const fileSections: string[] = [];

  for (const f of pr.files) {
    const patch = f.patch ?? "Binary file or no diff available";
    const truncatedPatch = truncateText(patch, maxPatchPerFile, `${f.filename} diff`);
    if (totalDiffChars + truncatedPatch.length > maxTotalDiff) {
      fileSections.push(
        `### ${f.filename} (${f.status}: +${f.additions} -${f.deletions})\n` +
          `*Diff omitted — total diff budget (${(maxTotalDiff / 1000).toFixed(0)}K chars) reached*`,
      );
      continue;
    }
    totalDiffChars += truncatedPatch.length;
    fileSections.push(
      `### ${f.filename} (${f.status}: +${f.additions} -${f.deletions})\n\`\`\`diff\n${truncatedPatch}\n\`\`\``,
    );
  }

  return fileSections;
}

export function buildReviewPrompt(
  pr: PullRequestInfo,
  strictness: string,
  fileSections: string[],
): string {
  return `You are an expert code reviewer. Review the following pull request.

**Review Strictness:** ${strictness}
${STRICTNESS_PROMPTS[strictness]}

**PR Title:** ${pr.title}
**PR Description:** ${pr.body ?? "No description provided."}

**Changed Files:**
${fileSections.join("\n\n")}

Provide your review as a JSON object with this structure:
{
  "summary": "Overall review summary in markdown",
  "comments": [
    {
      "path": "filename",
      "line": <line number in the new file>,
      "severity": "critical|warning|suggestion|nitpick",
      "comment": "Your comment"
    }
  ]
}

Guidelines:
- The "line" must be a line number that appears in the diff (within a + or unchanged line)
- Severity levels: critical (must fix), warning (should fix), suggestion (consider), nitpick (optional)
- Be specific and actionable in comments
- Include code examples in suggestions when helpful
- The summary should give an overall assessment and highlight the most important findings

Respond ONLY with the JSON object.`;
}
