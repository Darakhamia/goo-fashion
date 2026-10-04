/**
 * The AI check of the catalogue, for the studio.
 *
 *   GET                                   → status: settings, counts, spend, suggestions, applied fixes, runs
 *   POST {action:"settings", mode, model, monthlyBudgetUsd, notes}
 *   POST {action:"run", scope, cursor?, runId?}   → one step of a run (20 records); call again with the cursor
 *   POST {action:"brands", cursor?, runId?}       → one step of the brand review
 *   POST {action:"apply"|"dismiss"|"undo", ids}   → a person's decision on fixes
 *   POST {action:"undo_run", runId}               → undo every fix a run applied
 *
 * A run is driven from the admin's tab a step at a time, like the other long
 * jobs in the studio, so it shows progress and can be stopped. The background
 * sweep after imports lives in lib/server/catalogue-check/store.ts.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  checkPendingProducts,
  checkStatus,
  decideFixes,
  runBrandStep,
  runStep,
  saveCheckSettings,
  undoRun,
  type StepScope,
} from "@/lib/server/catalogue-check/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SCOPES = new Set<StepScope>(["unchecked", "changed", "all"]);
/** Fixes one decision may cover — a whole brand merge, a page of suggestions. */
const MAX_IDS = 2_000;

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  try {
    const status = await checkStatus();
    // Opening the page is also a moment to work through what is waiting.
    if (status.migrated && status.settings.mode !== "off") void checkPendingProducts();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Database not configured." }, { status: 501 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  try {
    if (action === "settings") {
      const { settings, error } = await saveCheckSettings({
        mode: body.mode,
        model: body.model,
        monthlyBudgetUsd: body.monthlyBudgetUsd,
        notes: body.notes,
      });
      if (error) return NextResponse.json({ error }, { status: 500 });
      void logAdminAction({
        admin_id: admin.userId,
        action: "catalogue_check.settings_updated",
        target_type: "settings",
        metadata: { mode: settings.mode, model: settings.model, monthlyBudgetUsd: settings.monthlyBudgetUsd },
      });
      return NextResponse.json({ ok: true, settings });
    }

    if (action === "run") {
      const scope = SCOPES.has(body.scope) ? (body.scope as StepScope) : "unchecked";
      const step = await runStep({
        scope,
        cursor: typeof body.cursor === "string" ? body.cursor : null,
        runId: typeof body.runId === "string" ? body.runId : null,
        adminId: admin.userId,
      });
      if (step.applied) {
        void logAdminAction({
          admin_id: admin.userId,
          action: "catalogue_check.fixed",
          target_type: "product",
          metadata: { runId: step.runId, checked: step.checked, applied: step.applied, suggested: step.suggested },
        });
      }
      return NextResponse.json({ ok: true, ...step });
    }

    if (action === "brands") {
      const step = await runBrandStep({
        cursor: typeof body.cursor === "string" ? body.cursor : null,
        runId: typeof body.runId === "string" ? body.runId : null,
        adminId: admin.userId,
      });
      const applied = step.merges.filter((m) => m.applied);
      if (applied.length) {
        void logAdminAction({
          admin_id: admin.userId,
          action: "catalogue_check.brands_unified",
          target_type: "product",
          metadata: { runId: step.runId, merges: applied.map((m) => `${m.from} → ${m.to} (${m.products})`) },
        });
      }
      return NextResponse.json({ ok: true, ...step });
    }

    if (action === "apply" || action === "dismiss" || action === "undo") {
      const ids = (Array.isArray(body.ids) ? body.ids : [])
        .map((v: unknown) => Number(v))
        .filter((v: number) => Number.isInteger(v) && v > 0)
        .slice(0, MAX_IDS);
      if (!ids.length) return NextResponse.json({ error: "No fixes given." }, { status: 400 });
      const result = await decideFixes(ids, action, admin.userId);
      void logAdminAction({
        admin_id: admin.userId,
        action: action === "apply" ? "catalogue_check.applied" : action === "dismiss" ? "catalogue_check.dismissed" : "catalogue_check.undone",
        target_type: "product",
        metadata: { ids: ids.slice(0, 50), done: result.done, stale: result.stale },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "undo_run") {
      const runId = String(body.runId ?? "");
      if (!runId) return NextResponse.json({ error: "No run given." }, { status: 400 });
      const result = await undoRun(runId, admin.userId);
      void logAdminAction({
        admin_id: admin.userId,
        action: "catalogue_check.undone",
        target_type: "product",
        metadata: { runId, done: result.done, stale: result.stale },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}
