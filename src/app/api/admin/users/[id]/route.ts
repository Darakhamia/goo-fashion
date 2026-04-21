import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin, isSuperAdminId } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";

interface ClerkError {
  errors?: { message?: string }[];
  status?: number;
  message?: string;
}

function errMsg(e: unknown): string {
  const ce = e as ClerkError;
  return ce?.errors?.[0]?.message || ce?.message || "Unknown error";
}

// GET /api/admin/users/[id] — full detail for a single user
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const cc = await clerkClient();
    const u = await cc.users.getUser(id);
    const meta = (u.publicMetadata ?? {}) as { plan?: string; isAdmin?: boolean };
    return NextResponse.json({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email: u.emailAddresses[0]?.emailAddress ?? null,
      emailAddresses: u.emailAddresses.map((e) => ({ id: e.id, email: e.emailAddress, verified: e.verification?.status === "verified" })),
      imageUrl: u.imageUrl,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastSignInAt: u.lastSignInAt,
      lastActiveAt: u.lastActiveAt ?? null,
      banned: u.banned,
      locked: u.locked,
      twoFactorEnabled: u.twoFactorEnabled,
      publicMetadata: u.publicMetadata,
      privateMetadata: u.privateMetadata,
      plan: meta.plan ?? "free",
      isAdmin: meta.isAdmin === true,
      isSuperAdmin: isSuperAdminId(u.id),
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id]
// Body supports { firstName?, lastName?, plan?, isAdmin?, banned?, locked? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Super admin account is immutable — no one can modify it via the admin panel.
  if (isSuperAdminId(id)) {
    return NextResponse.json(
      { error: "Super admin account is protected and cannot be modified." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const cc = await clerkClient();

    // Resolve admin email for audit log (best-effort)
    let adminEmail: string | undefined;
    try {
      const adminUser = await cc.users.getUser(admin.userId);
      adminEmail = adminUser.emailAddresses[0]?.emailAddress;
    } catch { /* non-critical */ }

    // Profile fields → updateUser
    if (typeof body.firstName === "string" || typeof body.lastName === "string") {
      await cc.users.updateUser(id, {
        ...(typeof body.firstName === "string" ? { firstName: body.firstName } : {}),
        ...(typeof body.lastName  === "string" ? { lastName:  body.lastName  } : {}),
      });
      void logAdminAction({
        admin_id: admin.userId,
        admin_email: adminEmail,
        action: "user.name_updated",
        target_id: id,
        target_type: "user",
        metadata: {
          firstName: body.firstName,
          lastName: body.lastName,
        },
      });
    }

    // publicMetadata fields (plan, isAdmin) → updateUserMetadata (merge with existing)
    if ("plan" in body || "isAdmin" in body) {
      const current = await cc.users.getUser(id);
      const currentMeta = (current.publicMetadata ?? {}) as { plan?: string; isAdmin?: boolean };
      const nextMeta = {
        ...currentMeta,
        ...("plan"    in body && typeof body.plan    === "string"  ? { plan:    body.plan    } : {}),
        ...("isAdmin" in body && typeof body.isAdmin === "boolean" ? { isAdmin: body.isAdmin } : {}),
      };
      await cc.users.updateUserMetadata(id, { publicMetadata: nextMeta });

      if ("plan" in body && body.plan !== currentMeta.plan) {
        void logAdminAction({
          admin_id: admin.userId,
          admin_email: adminEmail,
          action: "user.plan_changed",
          target_id: id,
          target_type: "user",
          metadata: { from: currentMeta.plan ?? "free", to: body.plan },
        });
      }
      if ("isAdmin" in body && typeof body.isAdmin === "boolean") {
        void logAdminAction({
          admin_id: admin.userId,
          admin_email: adminEmail,
          action: body.isAdmin ? "user.admin_granted" : "user.admin_revoked",
          target_id: id,
          target_type: "user",
        });
      }
    }

    // Ban / unban
    if (typeof body.banned === "boolean") {
      if (body.banned) {
        await cc.users.banUser(id);
        void logAdminAction({
          admin_id: admin.userId,
          admin_email: adminEmail,
          action: "user.banned",
          target_id: id,
          target_type: "user",
        });
      } else {
        await cc.users.unbanUser(id);
        void logAdminAction({
          admin_id: admin.userId,
          admin_email: adminEmail,
          action: "user.unbanned",
          target_id: id,
          target_type: "user",
        });
      }
    }

    // Lock / unlock
    if (typeof body.locked === "boolean") {
      if (body.locked) await cc.users.lockUser(id);
      else              await cc.users.unlockUser(id);
    }

    const updated = await cc.users.getUser(id);
    const meta = (updated.publicMetadata ?? {}) as { plan?: string; isAdmin?: boolean };
    return NextResponse.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.emailAddresses[0]?.emailAddress ?? null,
      imageUrl: updated.imageUrl,
      banned: updated.banned,
      locked: updated.locked,
      plan: meta.plan ?? "free",
      isAdmin: meta.isAdmin === true,
      isSuperAdmin: isSuperAdminId(updated.id),
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — hard-delete a user
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Super admin account cannot be deleted.
  if (isSuperAdminId(id)) {
    return NextResponse.json(
      { error: "Super admin account is protected and cannot be deleted." },
      { status: 403 }
    );
  }

  // Safety: admin cannot delete themselves.
  if (id === admin.userId) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  try {
    const cc = await clerkClient();

    let adminEmail: string | undefined;
    try {
      const adminUser = await cc.users.getUser(admin.userId);
      adminEmail = adminUser.emailAddresses[0]?.emailAddress;
    } catch { /* non-critical */ }

    // Capture target info before deletion
    let targetEmail: string | undefined;
    try {
      const target = await cc.users.getUser(id);
      targetEmail = target.emailAddresses[0]?.emailAddress;
    } catch { /* non-critical */ }

    await cc.users.deleteUser(id);

    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminEmail,
      action: "user.deleted",
      target_id: id,
      target_type: "user",
      metadata: { target_email: targetEmail },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
