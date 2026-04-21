import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ChatSession {
  surface: string;
  contextId: string;
  updatedAt: string;
  messageCount: number;
  lastText: string | null;
  lastRole: "user" | "assistant" | null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ sessions: [] });
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ sessions: [] });

  try {
    const { data, error } = await supabase
      .from("stylist_chats")
      .select("surface, context_id, messages, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error || !data) return NextResponse.json({ sessions: [] });

    const sessions: ChatSession[] = data
      .map((row) => {
        const msgs = Array.isArray(row.messages) ? row.messages : [];
        const last = msgs[msgs.length - 1] as { text?: string; role?: string } | undefined;
        return {
          surface: row.surface ?? "",
          contextId: row.context_id ?? "",
          updatedAt: row.updated_at ?? "",
          messageCount: msgs.length,
          lastText: last?.text ? String(last.text).slice(0, 90) : null,
          lastRole: (last?.role === "user" || last?.role === "assistant") ? (last.role as "user" | "assistant") : null,
        };
      })
      .filter((s) => s.messageCount > 0);

    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
