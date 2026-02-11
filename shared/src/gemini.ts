import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.0-flash";

export function createGeminiModel(
  apiKey: string,
  model: string = DEFAULT_MODEL,
): GenerativeModel {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

export async function generateContent(
  model: GenerativeModel,
  prompt: string,
): Promise<string> {
  const result = await model.generateContent(prompt);
  return result.response.text();
}
