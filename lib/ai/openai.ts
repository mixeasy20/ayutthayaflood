import { OpenAI } from 'openai';

/**
 * Server-only helper for OpenAI client initialization.
 * NOTE: OPENAI_API_KEY must never be prefixed with NEXT_PUBLIC_ or leaked to the client.
 */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'OPENAI_API_KEY is not configured on the server. Please add OPENAI_API_KEY to .env.local.'
    );
  }

  return new OpenAI({
    apiKey: apiKey.trim(),
  });
}

export function isOpenAIConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return Boolean(apiKey && apiKey.trim().length > 0);
}
