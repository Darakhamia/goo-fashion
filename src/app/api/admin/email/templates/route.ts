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

// Load failures are returned, not swallowed: saving on top of a failed or
// unparsable read would overwrite every stored template with just the new one.
async function loadTemplates(): Promise<{ templates: EmailTemplate[]; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { templates: [], error: "Supabase is not configured — templates cannot be stored." };
  }
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (error) return { templates: [], error: error.message };
  if (!data?.value) return { templates: [], error: null };
  try {
    const parsed: unknown = JSON.parse(data.value);
    return { templates: Array.isArray(parsed) ? (parsed as EmailTemplate[]) : [], error: null };
  } catch {
    return { templates: [], error: "Stored templates are not valid JSON." };
  }
}

async function saveTemplates(templates: EmailTemplate[]): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return "Supabase is not configured — templates cannot be stored.";
  const { error } = await supabase
    .from("settings")
    .upsert({ key: SETTINGS_KEY, value: JSON.stringify(templates) }, { onConflict: "key" });
  return error ? error.message : null;
}

// GET /api/admin/email/templates
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { templates, error } = await loadTemplates();
  if (error) return NextResponse.json({ error }, { status: 500 });
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

  const { templates, error: loadError } = await loadTemplates();
  if (loadError) return NextResponse.json({ error: loadError }, { status: 500 });
  const newTemplate: EmailTemplate = {
    id: crypto.randomUUID(),
    name: name.trim(),
    subject: subject.trim(),
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  templates.unshift(newTemplate);
  const saveError = await saveTemplates(templates);
  if (saveError) return NextResponse.json({ error: saveError }, { status: 500 });
  return NextResponse.json(newTemplate, { status: 201 });
}

// DELETE /api/admin/email/templates?id=...
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { templates, error: loadError } = await loadTemplates();
  if (loadError) return NextResponse.json({ error: loadError }, { status: 500 });
  const filtered = templates.filter((t) => t.id !== id);
  const saveError = await saveTemplates(filtered);
  if (saveError) return NextResponse.json({ error: saveError }, { status: 500 });
  return NextResponse.json({ ok: true });
}
