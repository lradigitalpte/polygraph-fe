"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, RotateCcw, Shield, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlowPanel, Segmented } from "@/components/dashboard/ui-kit";
import {
  deleteUser,
  fetchRoles,
  fetchUser,
  fetchUserActivity,
  fetchUserPermissions,
  requirePasswordReset,
  updateUserPermissions,
  type PermissionState,
  type RoleRecord,
  type UserActivityRecord,
  type UserRecord,
  updateUserRole,
  updateUserStatus,
} from "@/lib/users";
import { describeActivity, type ActivityKind } from "@/lib/activity-describe";
import { cn } from "@/lib/utils";

type Tab = "details" | "security" | "permissions" | "activity";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const SELECT =
  "h-11 w-full appearance-none rounded-xl border-0 bg-[#F3F1EA] px-3.5 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 dark:bg-muted";

function formatDateTime(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function relativeTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [2592000, "month"],
    [31536000, "year"],
  ];
  let best: [number, string] = units[0];
  for (const unit of units) if (seconds >= unit[0]) best = unit;
  const n = Math.floor(seconds / best[0]);
  return `${n} ${best[1]}${n === 1 ? "" : "s"} ago`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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

type ActivityView = "changes" | "all";

type ActivityEntry = { id: number; title: string; kind: ActivityKind; failed: boolean; time: string; count: number; method: string; path: string };

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [user, setUser] = React.useState<UserRecord | null>(null);
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [activity, setActivity] = React.useState<UserActivityRecord[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionState[]>([]);
  const [savingPerms, setSavingPerms] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("details");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const [activityView, setActivityView] = React.useState<ActivityView | null>(null);

  const activityEntries = React.useMemo<ActivityEntry[]>(
    () =>
      activity.map((log) => {
        const described = describeActivity(log);
        return { id: log.id, title: described.title, kind: described.kind, failed: log.status >= 400, time: log.created_at, count: 1, method: log.method.toUpperCase(), path: log.path };
      }),
    [activity],
  );
  const changeCount = activityEntries.filter((e) => e.kind === "change").length;
  const view: ActivityView = activityView ?? (changeCount > 0 ? "changes" : "all");
  const activityGroups = React.useMemo(() => {
    const shown = activityEntries.filter((e) => (view === "changes" ? e.kind === "change" : e.kind !== "background"));
    // Merge back-to-back repeats (a page that loads the same thing twice) into one row with a count.
    const merged: ActivityEntry[] = [];
    for (const entry of shown) {
      const prev = merged[merged.length - 1];
      if (prev && prev.title === entry.title && prev.failed === entry.failed && dayLabel(prev.time) === dayLabel(entry.time)) {
        prev.count += 1;
      } else {
        merged.push({ ...entry });
      }
    }
    const groups: { label: string; items: ActivityEntry[] }[] = [];
    for (const entry of merged) {
      const label = dayLabel(entry.time);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else groups.push({ label, items: [entry] });
    }
    return groups;
  }, [activityEntries, view]);

  const overrideCount = React.useMemo(() => permissions.filter((p) => p.effective !== p.role_default).length, [permissions]);
  const grantedCount = React.useMemo(() => permissions.filter((p) => p.effective).length, [permissions]);
  const recentChanges = React.useMemo(() => activityEntries.filter((e) => e.kind === "change").slice(0, 4), [activityEntries]);
  const groupedPerms = React.useMemo(() => {
    const map = new Map<string, PermissionState[]>();
    for (const p of permissions) {
      const g = p.group || "Other";
      const list = map.get(g) || [];
      list.push(p);
      map.set(g, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const load = React.useCallback(async () => {
    if (!id || Number.isNaN(id)) return;
    setError(null);
    try {
      const [userData, roleData, activityData, permsData] = await Promise.all([
        fetchUser(id),
        fetchRoles(),
        fetchUserActivity(id, 100),
        fetchUserPermissions(id),
      ]);
      setUser(userData);
      setRoles(roleData);
      setActivity(activityData);
      setPermissions(permsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!user || status === user.status) return;
    setSaving(true);
    try {
      const updated = await updateUserStatus(user.id, status);
      setUser(updated);
      toast.success(`User status updated to ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (roleId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateUserRole(user.id, Number(roleId));
      setUser(updated);
      toast.success("User role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await requirePasswordReset(user.id);
      setUser(updated);
      toast.success("Password reset requirement updated. Invite email ready to send.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to require password reset");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permId: number, checked: boolean) => {
    setPermissions((current) => current.map((p) => (p.id === permId ? { ...p, effective: checked } : p)));
  };

  const handleSavePermissions = async () => {
    if (!user) return;
    setSavingPerms(true);
    try {
      const overrides = permissions.filter((p) => p.effective !== p.role_default).map((p) => ({ permission_id: p.id, granted: p.effective }));
      await updateUserPermissions(user.id, overrides);
      // Reflect the saved state: anything differing from role default is now an override.
      setPermissions((current) => current.map((p) => ({ ...p, override: p.effective !== p.role_default ? p.effective : null })));
      toast.success(overrides.length === 0 ? "Reset to role defaults." : `Saved ${overrides.length} permission override${overrides.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSavingPerms(false);
    }
  };

  const handleResetPermissions = () => {
    setPermissions((current) => current.map((p) => ({ ...p, effective: p.role_default })));
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteUser(user.id);
      toast.success("User deleted");
      router.push("/dashboard/settings/users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <Link
        href="/dashboard/settings/users"
        className="inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All users
      </Link>

      {loading ? (
        <div aria-hidden="true" className="space-y-5">
          <div className="h-32 animate-pulse rounded-[26px] bg-white ring-1 ring-border/50 dark:bg-card" />
          <div className="h-64 animate-pulse rounded-[26px] bg-white ring-1 ring-border/50 dark:bg-card" />
        </div>
      ) : error || !user ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-[26px] bg-[#F8E4E0] p-5 text-sm text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200">
          <p>{error ?? "User not found"}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-current/30 transition-colors hover:bg-white/50"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Profile hero */}
          <GlowPanel
            tone={user.status === "active" ? "sage" : user.status === "suspended" ? "terracotta" : "amber"}
            orb="78%"
            lineTop={36}
            className="p-5 sm:p-7"
          >
            <div className="flex flex-col gap-5 pt-5 sm:flex-row sm:items-end sm:justify-between sm:pt-7">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <span className="bg-primary flex size-16 shrink-0 items-center justify-center rounded-3xl text-xl font-semibold tracking-wide text-white shadow-[0_8px_24px_-8px_rgba(201,100,66,0.8)] sm:size-20 sm:text-2xl">
                  {initials(user.name)}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[40px]">{user.name}</h1>
                  <p className="mt-1 truncate text-[15px] text-[#C9C6BC]">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-[#FAF9F5] ring-1 ring-white/15">
                  <Shield aria-hidden="true" className="size-3" />
                  {user.role?.name ?? "Unassigned"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-[#FAF9F5] capitalize ring-1 ring-white/15">
                  <span
                    aria-hidden="true"
                    className={cn("size-1.5 rounded-full", user.status === "active" ? "bg-[#7FBF8A]" : user.status === "suspended" ? "bg-[#E58A7E]" : "bg-[#E2B35A]")}
                  />
                  {user.status}
                </span>
                {relativeTime(user.last_active_at) ? (
                  <span className="rounded-full px-1 py-1.5 text-xs text-[#C9C6BC]">Active {relativeTime(user.last_active_at)?.toLowerCase()}</span>
                ) : null}
              </div>
            </div>
          </GlowPanel>

          <Segmented<Tab>
            label="User sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: "details", label: "Details" },
              { value: "security", label: "Security" },
              { value: "permissions", label: "Permissions", count: overrideCount > 0 ? overrideCount : undefined, title: overrideCount > 0 ? "Unsaved overrides" : undefined },
              { value: "activity", label: "Activity" },
            ]}
          />

          {/* Details */}
          {tab === "details" ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Role" value={user.role?.name ?? "Unassigned"} hint={user.role?.description || "Controls what they can access"} />
                <StatTile
                  label="Status"
                  value={<span className="capitalize">{user.status}</span>}
                  hint={user.status === "suspended" && user.suspended_at ? `Since ${formatDate(user.suspended_at)}` : user.status === "pending" ? "Has not signed in yet" : "Can sign in"}
                  tone={user.status === "active" ? "good" : user.status === "suspended" ? "bad" : "warn"}
                />
                <StatTile
                  label="Last active"
                  value={relativeTime(user.last_active_at) ?? "Never"}
                  hint={user.last_active_at ? formatDateTime(user.last_active_at) : "No sign-in recorded"}
                />
                <StatTile label="Member since" value={formatDate(user.created_at)} hint={user.invited_at ? `Invited ${formatDate(user.invited_at)}` : "Added directly, no invite sent"} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className={cn(CARD, "p-2")}>
                  <h2 className="px-4 pt-3 pb-1 text-[15px] font-medium">Account</h2>
                  <dl className="divide-y divide-border/50">
                    <InfoRow label="Name" value={user.name} />
                    <InfoRow label="Email" value={user.email} />
                    <InfoRow
                      label="Password"
                      value={user.password_reset_required ? <span className="text-[#8A5A12] dark:text-amber-300">Reset required</span> : "Up to date"}
                    />
                    {user.has_signature !== undefined ? (
                      <InfoRow label="Report signature" value={user.has_signature ? "Uploaded" : <span className="text-muted-foreground">Not set</span>} />
                    ) : null}
                    {user.signature_title ? <InfoRow label="Title" value={user.signature_title} /> : null}
                    <InfoRow label="Last updated" value={formatDate(user.updated_at)} />
                  </dl>
                </section>

                <section className={cn(CARD, "flex flex-col p-5 sm:p-6")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[15px] font-medium">Access</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {permissions.length === 0
                          ? "No permissions defined."
                          : `${grantedCount} of ${permissions.length} permissions granted${overrideCount > 0 ? ` · ${overrideCount} unsaved ${overrideCount === 1 ? "change" : "changes"}` : ""}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("permissions")}
                      className="flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                    >
                      Manage
                    </button>
                  </div>

                  {permissions.length > 0 ? (
                    <>
                      <div
                        role="progressbar"
                        aria-label="Permissions granted"
                        aria-valuemin={0}
                        aria-valuemax={permissions.length}
                        aria-valuenow={grantedCount}
                        className="mt-4 h-2 overflow-hidden rounded-full bg-[#ECE9E0] dark:bg-muted"
                      >
                        <div className="h-full rounded-full bg-[#30302E] dark:bg-secondary" style={{ width: `${(grantedCount / permissions.length) * 100}%` }} />
                      </div>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {groupedPerms.map(([group, items]) => {
                          const granted = items.filter((p) => p.effective).length;
                          return (
                            <li
                              key={group}
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-medium",
                                granted === 0 ? "bg-[#F3F1EA] text-muted-foreground dark:bg-muted" : "bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground",
                              )}
                            >
                              {group} <span className="tabular-nums opacity-70">{granted}/{items.length}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}
                </section>
              </div>

              <section className={cn(CARD, "overflow-hidden")}>
                <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
                  <h2 className="text-[15px] font-medium">Recent changes</h2>
                  <button type="button" onClick={() => setTab("activity")} className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                    See all activity
                  </button>
                </div>
                {recentChanges.length === 0 ? (
                  <p className="px-5 pt-1 pb-5 text-sm text-muted-foreground">This user has not created, edited or deleted anything yet.</p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {recentChanges.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{entry.title}</p>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.time}>
                          {relativeTime(entry.time)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {/* Security */}
          {tab === "security" ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className={cn(CARD, "space-y-5 p-5 sm:p-6")}>
                <div>
                  <h2 className="text-[15px] font-medium">Access</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Change the role or suspend access. Changes apply immediately.</p>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="user-role" className="px-1 text-[13px] font-medium">
                    Assigned role
                  </label>
                  <div className="relative">
                    <select id="user-role" className={SELECT} value={String(user.role_id)} disabled={saving} onChange={(e) => void handleRoleChange(e.target.value)}>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <span className="px-1 text-[13px] font-medium">Status</span>
                  <Segmented
                    label="Status"
                    value={user.status}
                    onChange={(v) => void handleStatusChange(v)}
                    className={cn("w-fit", saving && "pointer-events-none opacity-60")}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "pending", label: "Pending" },
                      { value: "suspended", label: "Suspended" },
                    ]}
                  />
                </div>
              </section>

              <section className={cn(CARD, "space-y-5 p-5 sm:p-6")}>
                <div>
                  <h2 className="text-[15px] font-medium">Password</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Force this user to choose a new password the next time they sign in.</p>
                </div>

                <dl className="divide-y divide-border/50 rounded-2xl bg-[#F7F6F1] px-4 dark:bg-muted/40">
                  <InfoRow compact label="Reset required" value={user.password_reset_required ? "Yes" : "No"} />
                  <InfoRow compact label="Reset requested" value={formatDateTime(user.password_reset_sent_at)} />
                  <InfoRow compact label="Suspended at" value={formatDateTime(user.suspended_at)} />
                </dl>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    disabled={saving}
                    className="flex h-10 items-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
                  >
                    {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    Require password reset
                  </button>
                  <Link
                    href="/dashboard/settings/users/new"
                    className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    Create another user
                  </Link>
                </div>
              </section>

              {/* Danger zone */}
              <section className="flex flex-col gap-4 rounded-[26px] bg-[#FBF1EF] p-5 ring-1 ring-destructive/20 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:col-span-2 dark:bg-red-950/30">
                <div className="flex items-start gap-3">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div>
                    <h2 className="text-[15px] font-medium text-destructive">Delete user</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">Permanently remove this staff account and their sign-in. This cannot be undone.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm("");
                    setDeleteOpen(true);
                  }}
                  className="flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 sm:self-auto"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete user
                </button>
              </section>
            </div>
          ) : null}

          {/* Permissions */}
          {tab === "permissions" ? (
            <div className="space-y-5">
              <div className={cn(CARD, "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6")}>
                <div>
                  <h2 className="text-[15px] font-medium">Permission overrides</h2>
                  <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                    Switches follow the <span className="font-medium text-foreground">{user.role?.name ?? "role"}</span> role. Changing one creates a per-user override that takes precedence.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPermissions}
                    disabled={savingPerms || overrideCount === 0}
                    className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-40 dark:hover:bg-muted"
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                    Reset to role
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSavePermissions()}
                    disabled={savingPerms}
                    className="flex h-10 items-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
                  >
                    {savingPerms ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    {savingPerms ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>

              {groupedPerms.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">No permissions defined.</p>
              ) : (
                groupedPerms.map(([group, items]) => (
                  <section key={group} aria-label={group} className={cn(CARD, "overflow-hidden")}>
                    <h3 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-medium">
                      {group}
                      <span className="rounded-full bg-[#F3F1EA] px-2 text-[11px] font-semibold text-muted-foreground tabular-nums dark:bg-muted">{items.length}</span>
                    </h3>
                    <ul className="divide-y divide-border/50">
                      {items.map((perm) => {
                        const isOverride = perm.effective !== perm.role_default;
                        return (
                          <li key={perm.id}>
                            <PermissionRow perm={perm} isOverride={isOverride} onChange={(checked) => togglePermission(perm.id, checked)} />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          ) : null}

          {/* Activity */}
          {tab === "activity" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Segmented<ActivityView>
                  label="Activity filter"
                  value={view}
                  onChange={setActivityView}
                  options={[
                    { value: "changes", label: "Changes", count: changeCount },
                    { value: "all", label: "All activity" },
                  ]}
                />
                <p className="px-1 text-[13px] text-muted-foreground">
                  {view === "changes" ? "Things this user created, edited or deleted." : "Includes pages they opened or viewed."}
                </p>
              </div>

              {activityGroups.length === 0 ? (
                <div className={cn(CARD, "px-6 py-14 text-center")}>
                  <p className="font-medium">{view === "changes" ? "No changes recorded" : "No recorded activity yet"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {view === "changes" ? "This user hasn't created, edited or deleted anything yet." : "Actions this user takes will show up here."}
                  </p>
                  {view === "changes" && activity.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setActivityView("all")}
                      className="mt-4 inline-flex h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                    >
                      Show all activity
                    </button>
                  ) : null}
                </div>
              ) : (
                activityGroups.map((group) => (
                  <section key={group.label} aria-label={group.label} className="space-y-2">
                    <h3 className="px-1 text-[13px] font-medium text-muted-foreground">{group.label}</h3>
                    <ul className={cn(CARD, "divide-y divide-border/50 overflow-hidden")}>
                      {group.items.map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 px-5 py-3.5" title={`${entry.method} ${entry.path}`}>
                          <span
                            aria-hidden="true"
                            className={cn("size-2 shrink-0 rounded-full", entry.failed ? "bg-[#B94A3E]" : entry.kind === "change" ? "bg-primary" : "bg-[#C9C5B8] dark:bg-zinc-600")}
                          />
                          <p className="min-w-0 flex-1 text-sm">
                            <span className={cn(entry.kind === "change" && "font-medium")}>{entry.title}</span>
                            {entry.count > 1 ? <span className="ml-2 rounded-full bg-[#F3F1EA] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums dark:bg-muted">×{entry.count}</span> : null}
                            {entry.failed ? <span className="ml-2 rounded-full bg-[#F8E4E0] px-2 py-0.5 text-[11px] font-medium text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200">Failed</span> : null}
                          </p>
                          <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={entry.time}>
                            {formatTime(entry.time)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          ) : null}

          {/* Delete confirmation */}
          <Dialog open={deleteOpen} onOpenChange={(next) => !deleting && setDeleteOpen(next)}>
            <DialogContent className="rounded-[26px]">
              <DialogHeader>
                <DialogTitle>Delete {user.name}?</DialogTitle>
                <DialogDescription>The user will be removed from the system and will no longer be able to sign in. This cannot be undone.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1.5">
                <label htmlFor="delete-confirm" className="px-1 text-[13px] font-medium">
                  Type <span className="font-semibold">{user.email}</span> to confirm
                </label>
                <input
                  id="delete-confirm"
                  autoComplete="off"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={user.email}
                  className="h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted"
                />
              </div>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase()}
                  className="flex h-10 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deleting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
                  Delete user
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={cn(CARD, "p-5")}>
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {tone ? (
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", tone === "good" ? "bg-[#3F7A37] dark:bg-emerald-400" : tone === "bad" ? "bg-[#B94A3E] dark:bg-red-400" : "bg-[#C98A1F] dark:bg-amber-400")}
          />
        ) : null}
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-medium tracking-[-0.02em]">{value}</p>
      {hint ? <p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, value, compact }: { label: string; value: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", compact ? "py-3" : "px-4 py-3.5")}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function PermissionRow({ perm, isOverride, onChange }: { perm: PermissionState; isOverride: boolean; onChange: (checked: boolean) => void }) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-3.5 transition-colors", isOverride && "bg-primary/6")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {perm.name}
          </label>
          {isOverride ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                perm.effective ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" : "bg-[#F8E4E0] text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200",
              )}
            >
              {perm.effective ? "Granted" : "Denied"} override
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{perm.description || "No description"}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={perm.effective}
        onClick={() => onChange(!perm.effective)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          perm.effective ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", perm.effective ? "translate-x-5" : "translate-x-0")}
        />
      </button>
    </div>
  );
}
