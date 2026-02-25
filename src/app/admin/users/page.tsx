"use client";

import { useState, useMemo } from "react";

interface MockUser {
  id: string;
  name: string;
  email: string;
  plan: "free" | "plus" | "ultra";
  joined: string;
  saves: number;
  status: "active" | "inactive";
}

const MOCK_USERS: MockUser[] = [
  { id: "u-001", name: "Sophia Laurent", email: "sophia.laurent@gmail.com", plan: "ultra", joined: "Jan 12, 2024", saves: 47, status: "active" },
  { id: "u-002", name: "Marcus Chen", email: "marcus.chen@outlook.com", plan: "plus", joined: "Feb 3, 2024", saves: 23, status: "active" },
  { id: "u-003", name: "Elena Vasquez", email: "elena.v@icloud.com", plan: "free", joined: "Feb 18, 2024", saves: 8, status: "active" },
  { id: "u-004", name: "James Holloway", email: "j.holloway@proton.me", plan: "ultra", joined: "Mar 1, 2024", saves: 61, status: "active" },
  { id: "u-005", name: "Ines Moreau", email: "ines.moreau@gmail.com", plan: "plus", joined: "Mar 9, 2024", saves: 19, status: "active" },
  { id: "u-006", name: "Kenji Tanaka", email: "kenji.t@yahoo.com", plan: "free", joined: "Mar 22, 2024", saves: 4, status: "inactive" },
  { id: "u-007", name: "Amara Osei", email: "amara.osei@gmail.com", plan: "plus", joined: "Apr 5, 2024", saves: 31, status: "active" },
  { id: "u-008", name: "Luca Ferrari", email: "luca.f@icloud.com", plan: "free", joined: "Apr 14, 2024", saves: 6, status: "active" },
  { id: "u-009", name: "Nadia Petrov", email: "nadia.petrov@mail.com", plan: "ultra", joined: "Apr 29, 2024", saves: 78, status: "active" },
  { id: "u-010", name: "Oliver Park", email: "oliver.park@gmail.com", plan: "plus", joined: "May 3, 2024", saves: 15, status: "active" },
  { id: "u-011", name: "Clara Dubois", email: "clara.dubois@orange.fr", plan: "free", joined: "May 17, 2024", saves: 2, status: "inactive" },
  { id: "u-012", name: "Yuki Nakamura", email: "yuki.n@docomo.ne.jp", plan: "ultra", joined: "Jun 1, 2024", saves: 53, status: "active" },
  { id: "u-013", name: "Rafael Gomes", email: "rafael.g@gmail.com", plan: "free", joined: "Jun 8, 2024", saves: 9, status: "active" },
  { id: "u-014", name: "Astrid Lindgren", email: "astrid.l@gmail.se", plan: "plus", joined: "Jun 20, 2024", saves: 27, status: "active" },
  { id: "u-015", name: "Fatoumata Diallo", email: "fatoumata.d@gmail.com", plan: "free", joined: "Jul 2, 2024", saves: 3, status: "active" },
  { id: "u-016", name: "Daniel Kim", email: "daniel.kim@naver.com", plan: "plus", joined: "Jul 15, 2024", saves: 11, status: "active" },
  { id: "u-017", name: "Priya Sharma", email: "priya.s@gmail.com", plan: "ultra", joined: "Aug 4, 2024", saves: 42, status: "active" },
  { id: "u-018", name: "Tomás Reyes", email: "tomas.r@hotmail.com", plan: "free", joined: "Aug 19, 2024", saves: 7, status: "inactive" },
  { id: "u-019", name: "Camille Bernard", email: "camille.b@gmail.fr", plan: "plus", joined: "Sep 3, 2024", saves: 18, status: "active" },
  { id: "u-020", name: "Zara Aldridge", email: "zara.a@icloud.com", plan: "ultra", joined: "Sep 14, 2024", saves: 65, status: "active" },
];

const planBadge: Record<MockUser["plan"], string> = {
  free: "border border-[var(--border)] text-[var(--foreground-muted)]",
  plus: "bg-amber-400/15 text-amber-600 border border-amber-400/30",
  ultra: "bg-[var(--foreground)] text-[var(--background)]",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["#C8BEA8", "#9BB0C8", "#B5896A", "#A8BF9E", "#D4956A", "#BDB8AE"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<MockUser["plan"] | "all">("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users
      .filter((u) => planFilter === "all" || u.plan === planFilter)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search, planFilter]);

  const stats = {
    total: users.length,
    ultra: users.filter((u) => u.plan === "ultra").length,
    plus: users.filter((u) => u.plan === "plus").length,
    free: users.filter((u) => u.plan === "free").length,
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this user?")) return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const inputCls =
    "bg-transparent border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Users</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">{users.length} registered</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: stats.total, note: "registered" },
          { label: "Ultra", value: stats.ultra, note: "subscribers" },
          { label: "Plus", value: stats.plus, note: "subscribers" },
          { label: "Free", value: stats.free, note: "accounts" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--background)] border border-[var(--border)] p-5">
            <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">{s.label}</p>
            <p className="font-display text-3xl font-light text-[var(--foreground)]">{s.value}</p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls + " w-full pr-8"}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]">×</button>
          )}
        </div>
        <div className="flex gap-1.5">
          {(["all", "free", "plus", "ultra"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`text-[9px] tracking-[0.14em] uppercase px-3 py-2.5 border transition-colors duration-200 capitalize ${
                planFilter === p
                  ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["User", "Email", "Plan", "Joined", "Saves", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => {
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <tr key={user.id} className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 flex items-center justify-center text-[9px] font-medium text-[var(--background)] shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {initials(user.name)}
                      </div>
                      <span className="text-xs font-medium text-[var(--foreground)]">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] tracking-[0.1em] uppercase px-2 py-1 ${planBadge[user.plan]}`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{user.joined}</td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{user.saves}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] tracking-[0.1em] uppercase px-2 py-1 ${
                      user.status === "active"
                        ? "text-[var(--foreground-muted)] border border-[var(--border)]"
                        : "text-[var(--foreground-subtle)]"
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => handleDelete(user.id)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4H13M6 4V2H10V4M5 4L5.5 13H10.5L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">No users found</div>
        )}
      </div>
    </div>
  );
}
