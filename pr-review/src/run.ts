import {
  generateContent,
  parseJsonResponse,
  getPullRequest,
  createReview,
  ActionContext,
} from "@gemini-actions/shared";
import { STRICTNESS_PROMPTS, buildFileSections, buildReviewPrompt } from "./prompts";
import { GeminiReview, filterValidComments, buildSummaryBody } from "./review";

export interface PrReviewInputs {
  prNumber: number;
  strictness: string;
}

export async function runPrReview(
  ctx: ActionContext,
  inputs: PrReviewInputs,
): Promise<void> {
  const { octokit, owner, repo, model } = ctx;
  const { prNumber, strictness } = inputs;

  if (!STRICTNESS_PROMPTS[strictness]) {
    throw new Error(
      `Invalid review_strictness: ${strictness}. Must be low, medium, or high.`,
    );
  }

  // 1. Get PR details and diff
  const pr = await getPullRequest(octokit, owner, repo, prNumber);

  // 2. Build the review prompt with truncated diffs
  const fileSections = buildFileSections(pr);
  const prompt = buildReviewPrompt(pr, strictness, fileSections);

  const response = await generateContent(model, prompt);
  let review: GeminiReview;
  try {
    review = parseJsonResponse<GeminiReview>(response);
  } catch {
    // If parsing fails, post the raw response as a comment
    await createReview(
      octokit,
      owner,
      repo,
      prNumber,
      `## Gemini Code Review (${strictness} strictness)\n\n${response}`,
    );
    return;
  }

  // 3. Format and post the review
  const reviewComments = filterValidComments(review.comments, pr);
  const summaryBody = buildSummaryBody(review, strictness);

  await createReview(
    octokit,
    owner,
    repo,
    prNumber,
    summaryBody,
    reviewComments,
  );
}
