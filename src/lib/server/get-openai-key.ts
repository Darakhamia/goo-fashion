import { supabase } from "@/lib/supabase";

/**
 * Resolves the shared OpenAI API key for server-side use only.
 * Priority: OPENAI_API_KEY env var → Supabase settings table → null
 *
 * Never import this from client components — it reads process.env and calls Supabase
 * with the service-role key. Safe to call from API routes and Server Components.
 */
export async function getOpenAIKey(): Promise<string | null> {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  if (!supabase) return null;

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "openai_api_key")
    .maybeSingle();

  return (data as { value: string } | null)?.value?.trim() ?? null;
}
