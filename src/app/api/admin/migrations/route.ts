/**
 * POST /api/admin/migrations — apply pending migrations now (super admin only).
 *
 * Every deploy already runs scripts/migrate.mjs before the site starts. This is
 * the same script, for when that run could not finish — the database was
 * unreachable for a moment, or a file failed and a fix has since been deployed
 * as a new file. It applies only files this build carries, so nothing reaches
 * the database that did not go through a merge first.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { isSuperAdminId, requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIMEOUT_MS = 5 * 60_000;
/** Enough log to see what happened, not a megabyte of it. */
const MAX_LOG = 20_000;

function runMigrations(): Promise<{ code: number | null; log: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "migrate.mjs"), "--strict"], {
      cwd: process.cwd(),
      env: process.env,
    });
    let log = "";
    const take = (chunk: Buffer) => {
      if (log.length < MAX_LOG) log += chunk.toString("utf8");
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, log: `${log}\n${err.message}`.trim() });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, log: log.trim() });
    });
  });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdminId(admin.userId)) {
    return NextResponse.json({ error: "Only the super admin can apply migrations." }, { status: 403 });
  }

  const { code, log } = await runMigrations();
  await logAdminAction({
    admin_id: admin.userId,
    action: "settings.migrations_applied",
    target_type: "database",
    metadata: { exitCode: code, log: log.slice(-2_000) },
  });
  return NextResponse.json({ ok: code === 0, exitCode: code, log });
}
