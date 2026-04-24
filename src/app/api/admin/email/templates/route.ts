import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

const SETTINGS_KEY = "email_templates";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

async function loadTemplates(): Promise<EmailTemplate[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (!data?.value) return [];
  try {
    return JSON.parse(data.value) as EmailTemplate[];
  } catch {
    return [];
  }
}

async function saveTemplates(templates: EmailTemplate[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase
    .from("settings")
    .upsert({ key: SETTINGS_KEY, value: JSON.stringify(templates) }, { onConflict: "key" });
}

// GET /api/admin/email/templates
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await loadTemplates();
  return NextResponse.json(templates);
}

// POST /api/admin/email/templates — create
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, subject, body } = await req.json().catch(() => ({}));
  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 });
  }

  const templates = await loadTemplates();
  const newTemplate: EmailTemplate = {
    id: crypto.randomUUID(),
    name: name.trim(),
    subject: subject.trim(),
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  templates.unshift(newTemplate);
  await saveTemplates(templates);
  return NextResponse.json(newTemplate, { status: 201 });
}

// DELETE /api/admin/email/templates?id=...
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const templates = await loadTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  await saveTemplates(filtered);
  return NextResponse.json({ ok: true });
}
