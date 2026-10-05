import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseConfiguration = {
  url: string;
  publishableKey: string;
};

let supabaseClient: SupabaseClient | undefined;

export function getSupabaseConfiguration(): SupabaseConfiguration | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const configuration = getSupabaseConfiguration();
  if (!configuration) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  supabaseClient = createClient(configuration.url, configuration.publishableKey);
  return supabaseClient;
}