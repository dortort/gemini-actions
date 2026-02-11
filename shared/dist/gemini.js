"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiModel = createGeminiModel;
exports.countTokens = countTokens;
exports.generateContent = generateContent;
exports.truncateText = truncateText;
const core = __importStar(require("@actions/core"));
const generative_ai_1 = require("@google/generative-ai");
const DEFAULT_MODEL = "gemini-2.0-flash";
/**
 * Conservative input token budget — reserves room for the model's output.
 * Gemini 2.0 Flash supports 1M input tokens; we cap at 900K.
 */
const DEFAULT_MAX_INPUT_TOKENS = 900_000;
function createGeminiModel(apiKey, model = DEFAULT_MODEL) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model });
}
/**
 * Count the number of tokens in a prompt using the Gemini API.
 */
async function countTokens(model, content) {
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
async function generateContent(model, prompt, maxInputTokens = DEFAULT_MAX_INPUT_TOKENS) {
    const tokenCount = await countTokens(model, prompt);
    core.info(`Prompt size: ${tokenCount.toLocaleString()} tokens`);
    if (tokenCount > maxInputTokens) {
        throw new Error(`Prompt too large: ${tokenCount.toLocaleString()} tokens exceeds the ` +
            `${maxInputTokens.toLocaleString()} token budget. Reduce input size.`);
    }
    if (tokenCount > maxInputTokens * 0.9) {
        core.warning(`Prompt is ${tokenCount.toLocaleString()} tokens — ` +
            `approaching the ${maxInputTokens.toLocaleString()} token limit.`);
    }
    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
    catch (error) {
        if (error instanceof generative_ai_1.GoogleGenerativeAIFetchError) {
            if (error.status === 400 && error.message.includes("token")) {
                throw new Error(`Gemini rejected the request (prompt too large: ${tokenCount.toLocaleString()} tokens). ` +
                    `Original error: ${error.message}`);
            }
            if (error.status === 429) {
                throw new Error(`Gemini rate limit exceeded. Retry later. Original error: ${error.message}`);
            }
        }
        throw error;
    }
}
/**
 * Truncate text to a character budget, appending a notice when truncated.
 */
function truncateText(text, maxChars, label = "content") {
    if (text.length <= maxChars)
        return text;
    const truncated = text.slice(0, maxChars);
    return `${truncated}\n\n... [${label} truncated: ${(text.length - maxChars).toLocaleString()} characters omitted]`;
}
//# sourceMappingURL=gemini.js.map