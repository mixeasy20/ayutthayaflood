import { GoogleGenAI } from '@google/genai';

/**
 * Server-only Google Gemini AI client helper.
 * Uses GEMINI_API_KEY / GOOGLE_API_KEY from process.env (never exposed to client).
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith('AQ.') ? process.env.OPENAI_API_KEY : undefined);

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY to .env.local.'
    );
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}

export function isGeminiConfigured(): boolean {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith('AQ.') ? process.env.OPENAI_API_KEY : undefined);

  return Boolean(apiKey && apiKey.trim().length > 0);
}
