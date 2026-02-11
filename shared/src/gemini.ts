import * as core from "@actions/core";
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Conservative input token budget — reserves room for the model's output.
 * Gemini 2.0 Flash supports 1M input tokens; we cap at 900K.
 */
const DEFAULT_MAX_INPUT_TOKENS = 900_000;

export function createGeminiModel(
  apiKey: string,
  model: string = DEFAULT_MODEL,
): GenerativeModel {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

/**
 * Count the number of tokens in a prompt using the Gemini API.
 */
export async function countTokens(
  model: GenerativeModel,
  content: string,
): Promise<number> {
  const result = await model.countTokens(content);
  return result.totalTokens;
}

/**
 * Send a prompt to Gemini with pre-flight token counting and clear error handling.
 *
 * - Counts tokens before sending and logs the count.
 * - Warns if the prompt approaches the token budget.
 * - Catches Gemini-specific errors (HTTP 400/429) and surfaces actionable messages.
 */
export async function generateContent(
  model: GenerativeModel,
  prompt: string,
  maxInputTokens: number = DEFAULT_MAX_INPUT_TOKENS,
): Promise<string> {
  const tokenCount = await countTokens(model, prompt);
  core.info(`Prompt size: ${tokenCount.toLocaleString()} tokens`);

  if (tokenCount > maxInputTokens) {
    throw new Error(
      `Prompt too large: ${tokenCount.toLocaleString()} tokens exceeds the ` +
        `${maxInputTokens.toLocaleString()} token budget. Reduce input size.`,
    );
  }

  if (tokenCount > maxInputTokens * 0.9) {
    core.warning(
      `Prompt is ${tokenCount.toLocaleString()} tokens — ` +
        `approaching the ${maxInputTokens.toLocaleString()} token limit.`,
    );
  }

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    if (error instanceof GoogleGenerativeAIFetchError) {
      if (error.status === 400 && error.message.includes("token")) {
        throw new Error(
          `Gemini rejected the request (prompt too large: ${tokenCount.toLocaleString()} tokens). ` +
            `Original error: ${error.message}`,
        );
      }
      if (error.status === 429) {
        throw new Error(
          `Gemini rate limit exceeded. Retry later. Original error: ${error.message}`,
        );
      }
    }
    throw error;
  }
}

/**
 * Truncate text to a character budget, appending a notice when truncated.
 */
export function truncateText(
  text: string,
  maxChars: number,
  label: string = "content",
): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  return `${truncated}\n\n... [${label} truncated: ${(text.length - maxChars).toLocaleString()} characters omitted]`;
}
