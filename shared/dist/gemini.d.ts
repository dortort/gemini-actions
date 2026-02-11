import { GenerativeModel } from "@google/generative-ai";
export declare function createGeminiModel(apiKey: string, model?: string): GenerativeModel;
export declare function generateContent(model: GenerativeModel, prompt: string): Promise<string>;
//# sourceMappingURL=gemini.d.ts.map