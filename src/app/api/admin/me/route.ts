import { NextResponse } from "next/server";
import { requireAdmin, isSuperAdminId } from "@/lib/server/admin-auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    userId: admin.userId,
    isSuperAdmin: isSuperAdminId(admin.userId),
  });
}
