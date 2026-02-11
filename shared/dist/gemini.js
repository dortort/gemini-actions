"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiModel = createGeminiModel;
exports.generateContent = generateContent;
const generative_ai_1 = require("@google/generative-ai");
const DEFAULT_MODEL = "gemini-2.0-flash";
function createGeminiModel(apiKey, model = DEFAULT_MODEL) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model });
}
async function generateContent(model, prompt) {
    const result = await model.generateContent(prompt);
    return result.response.text();
}
//# sourceMappingURL=gemini.js.map