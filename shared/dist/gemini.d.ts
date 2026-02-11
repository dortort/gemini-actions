import { GenerativeModel } from "@google/generative-ai";
export declare function createGeminiModel(apiKey: string, model?: string): GenerativeModel;
/**
 * Count the number of tokens in a prompt using the Gemini API.
 */
export declare function countTokens(model: GenerativeModel, content: string): Promise<number>;
/**
 * Send a prompt to Gemini with pre-flight token counting and clear error handling.
 *
 * - Counts tokens before sending and logs the count.
 * - Warns if the prompt approaches the token budget.
 * - Catches Gemini-specific errors (HTTP 400/429) and surfaces actionable messages.
 */
export declare function generateContent(model: GenerativeModel, prompt: string, maxInputTokens?: number): Promise<string>;
/**
 * Truncate text to a character budget, appending a notice when truncated.
 */
export declare function truncateText(text: string, maxChars: number, label?: string): string;
//# sourceMappingURL=gemini.d.ts.map