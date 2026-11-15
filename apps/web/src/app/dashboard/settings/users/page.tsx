"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Search, Shield, ShieldCheck, UserCheck, UserPlus, Users, UserX, X } from "lucide-react";

import { GlassStat, HeroAction, PageHero } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import { fetchUsers, type UserRecord } from "@/lib/users";
import { cn } from "@/lib/utils";

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] pl-10 pr-3.5 text-sm shadow-none dark:bg-muted";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function roleName(user: UserRecord): string {
  return user.role?.name || "Unassigned";
}

function statusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300";
    case "suspended":
      return "bg-[#F8E4E0] text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200";
    default:
      return "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-300";
  }
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState("all");

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setUsers(await fetchUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const roles = React.useMemo(() => Array.from(new Set(users.map(roleName))).sort(), [users]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== "all" && roleName(u) !== role) return false;
      return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, query, role]);

  const filtered = query.trim() !== "" || role !== "all";

  return (
    <div className="space-y-5 pb-10">
      <PageHero
        tone="lavender"
        icon={Users}
        eyebrow="People & access"
        title={<>Team <strong className="font-semibold">members</strong></>}
        description="Manage your organization's team members and their access levels."
        actions={
          <HeroAction variant="primary" icon={UserPlus} href="/dashboard/settings/users/new">
            Invite user
          </HeroAction>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Team members" value={users.length} hint="In your organization" icon={Users} accent="lavender" loading={loading} />
          <GlassStat label="Active" value={users.filter((u) => u.status.toLowerCase() === "active").length} hint="Can sign in" icon={UserCheck} accent="sage" loading={loading} />
          <GlassStat label="Admins" value={users.filter((u) => roleName(u) === "Admin").length} hint="Full access" icon={ShieldCheck} accent="terracotta" loading={loading} />
          <GlassStat
            label="Needs attention"
            value={users.filter((u) => ["suspended", "pending"].includes(u.status.toLowerCase())).length}
            hint="Suspended or pending"
            icon={UserX}
            accent="amber"
            loading={loading}
          />
        </div>
      </PageHero>

      <div className="overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search users"
              placeholder="Search by name or email…"
              className={FIELD}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {roles.length > 1 ? (
            <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-1.5">
              {["all", ...roles].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                    role === r
                      ? "bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground"
                      : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
                  )}
                >
                  {r === "all" ? "All" : r}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 px-5 py-2.5 text-[13px] text-muted-foreground">
          <span>
            {loading ? "Loading…" : filtered ? `${visible.length} of ${users.length} users` : `${users.length} ${users.length === 1 ? "user" : "users"}`}
          </span>
          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setRole("all");
              }}
              className="flex items-center gap-1 rounded-full px-2 py-1 font-medium hover:text-foreground"
            >
              <X aria-hidden="true" className="size-3.5" />
              Clear
            </button>
          ) : null}
        </div>

        {/* List */}
        {loading ? (
          <div aria-hidden="true" className="divide-y divide-border/50 border-t border-border/50">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="size-11 animate-pulse rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-56 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col items-start gap-3 border-t border-border/50 p-5 text-sm text-destructive">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-current/30 transition-colors hover:bg-destructive/10"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <Users aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">{filtered ? "No users match" : "No users yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{filtered ? "Try a different name, email or role." : "Invite your first team member to get started."}</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/50 border-t border-border/50">
            {visible.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/dashboard/settings/users/${user.id}` as Route}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#30302E] text-[13px] font-semibold tracking-wide text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground">
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{user.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden items-center gap-1.5 rounded-full bg-[#ECE9E0] px-2.5 py-1 text-xs font-medium text-[#3D3929] sm:inline-flex dark:bg-muted dark:text-foreground">
                      <Shield aria-hidden="true" className="size-3" />
                      {roleName(user)}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", statusClasses(user.status))}>{user.status}</span>
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
