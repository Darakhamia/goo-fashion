import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_BLOG_SYSTEM_PROMPT,
  DEFAULT_BLOG_USER_PROMPT,
  DEFAULT_EMAIL_PROMPT,
  DEFAULT_STYLIST_PROMPT,
  DEFAULT_IMAGE_FIDELITY,
  DEFAULT_IMAGE_MANNEQUIN,
  DEFAULT_IMAGE_FLATLAY,
  DEFAULT_IMAGE_TRYON,
} from "@/lib/server/prompt-defaults";

export const PROMPT_META: Record<string, { label: string; description: string; default: string; category: string }> = {
  prompt_blog_system: {
    label: "Blog — System",
    description: "Системный промт для генерации статей блога. Задаёт роль и формат вывода.",
    default: DEFAULT_BLOG_SYSTEM_PROMPT,
    category: "content",
  },
  prompt_blog_user: {
    label: "Blog — User",
    description: "Пользовательский промт для блога. Используй {{url}} и {{content}} — они будут заменены при генерации.",
    default: DEFAULT_BLOG_USER_PROMPT,
    category: "content",
  },
  prompt_email: {
    label: "Email — AI Write",
    description: "Промт для AI-генерации тела письма. Используй {{subject}} и {{brief}}.",
    default: DEFAULT_EMAIL_PROMPT,
    category: "content",
  },
  prompt_stylist: {
    label: "AI Stylist — System",
    description: "Системный промт стилиста. Используй {{personalization}}, {{catalog}}, {{outfit_context}} — они подставляются динамически.",
    default: DEFAULT_STYLIST_PROMPT,
    category: "stylist",
  },
  prompt_image_fidelity: {
    label: "Image — Fidelity block",
    description: "Блок точности воспроизведения одежды. Вставляется через {{fidelity}} в каждый стиль генерации.",
    default: DEFAULT_IMAGE_FIDELITY,
    category: "image",
  },
  prompt_image_mannequin: {
    label: "Image — Mannequin",
    description: "Промт для генерации на манекене. Используй {{items}} и {{fidelity}}.",
    default: DEFAULT_IMAGE_MANNEQUIN,
    category: "image",
  },
  prompt_image_flatlay: {
    label: "Image — Flatlay",
    description: "Промт для раскладки на полу/поверхности. Используй {{items}} и {{fidelity}}.",
    default: DEFAULT_IMAGE_FLATLAY,
    category: "image",
  },
  prompt_image_tryon: {
    label: "Image — Try-on",
    description: "Промт для примерки на человеке. Используй {{items}} и {{fidelity}}.",
    default: DEFAULT_IMAGE_TRYON,
    category: "image",
  },
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const keys = Object.keys(PROMPT_META);
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", keys);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const saved: Record<string, string> = {};
  for (const row of data ?? []) saved[row.key] = row.value;

  const result = keys.map((key) => ({
    key,
    ...PROMPT_META[key],
    value: saved[key] ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { key, value } = await req.json().catch(() => ({}));
  if (!key || !(key in PROMPT_META)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  if (typeof value !== "string") return NextResponse.json({ error: "value must be a string" }, { status: 400 });

  const { error } = await supabase
    .from("settings")
    .upsert({ key, value: value.trim(), updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key || !(key in PROMPT_META)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });

  const { error } = await supabase.from("settings").delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
