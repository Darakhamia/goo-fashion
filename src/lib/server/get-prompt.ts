import { supabase } from "@/lib/supabase";

export async function getPrompt(key: string, defaultValue: string): Promise<string> {
  if (!supabase) return defaultValue;
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const v = (data as { value: string } | null)?.value?.trim();
    return v || defaultValue;
  } catch {
    return defaultValue;
  }
}
