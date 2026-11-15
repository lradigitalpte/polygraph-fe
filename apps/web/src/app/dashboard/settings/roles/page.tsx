"use client";

import * as React from "react";
import { ChevronDown, KeyRound, Loader2, Pencil, Plus, Search, Shield, ShieldAlert, UserCheck, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GlassStat, HeroAction, PageHero, Segmented } from "@/components/dashboard/ui-kit";
import { describeActivity } from "@/lib/activity-describe";
import { fetchAuditLogs, type AuditLogRecord } from "@/lib/audit-logs";
import { fetchUsers, type UserRecord } from "@/lib/users";
import {
  createRole,
  updateRole,
  fetchPermissions,
  fetchRoles,
  type PermissionRecord,
  type RoleRecord,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const ACTIVITY_STEP = 8;

type RoleFilter = "all" | "assigned" | "unassigned";
type RoleSort = "name" | "users" | "permissions";
type ActivityFilter = "changes" | "all" | "failed";

function permissionLabel(permission: PermissionRecord): string {
  return permission.description || permission.name.replace(/:/g, " ");
}

function roleUserCount(role: RoleRecord, users: UserRecord[]): number {
  return users.filter((user) => user.role?.id === role.id && user.status.toLowerCase() === "active").length;
}

function roleActivities(logs: AuditLogRecord[]): AuditLogRecord[] {
  return logs.filter((log) => log.path.includes("/api/rbac") || log.path.includes("/role"));
}

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function groupPermissions(permissions: PermissionRecord[]): Array<[string, PermissionRecord[]]> {
  const grouped = new Map<string, PermissionRecord[]>();
  for (const permission of permissions) {
    const group = permission.group || "Other";
    const list = grouped.get(group) || [];
    list.push(permission);
    grouped.set(group, list);
  }
  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function RolesPage() {
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [activity, setActivity] = React.useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RoleRecord | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<number[]>([]);
  const groupedPermissions = React.useMemo(() => groupPermissions(permissions), [permissions]);

  const [roleSearch, setRoleSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("all");
  const [roleSort, setRoleSort] = React.useState<RoleSort>("name");

  const [activitySearch, setActivitySearch] = React.useState("");
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>("changes");
  const [activityShown, setActivityShown] = React.useState(ACTIVITY_STEP);

  const hasRoleFilters = Boolean(roleSearch.trim()) || roleFilter !== "all";

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const [roleData, permissionData, userData, auditData] = await Promise.all([fetchRoles(), fetchPermissions(), fetchUsers(), fetchAuditLogs(100)]);
      setRoles(roleData);
      setPermissions(permissionData);
      setUsers(userData);
      setActivity(roleActivities(auditData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setActivityShown(ACTIVITY_STEP);
  }, [activitySearch, activityFilter]);

  const filteredRoles = React.useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    const rows = roles.filter((role) => {
      const assignedUsers = roleUserCount(role, users);
      const permissionText = (role.permissions || []).map(permissionLabel).join(" ").toLowerCase();
      const matchesSearch = !q || role.name.toLowerCase().includes(q) || (role.description ?? "").toLowerCase().includes(q) || permissionText.includes(q);
      const matchesFilter = roleFilter === "all" || (roleFilter === "assigned" && assignedUsers > 0) || (roleFilter === "unassigned" && assignedUsers === 0);
      return matchesSearch && matchesFilter;
    });
    return [...rows].sort((a, b) => {
      if (roleSort === "users") return roleUserCount(b, users) - roleUserCount(a, users);
      if (roleSort === "permissions") return (b.permissions?.length ?? 0) - (a.permissions?.length ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [roles, users, roleSearch, roleFilter, roleSort]);

  const describedActivity = React.useMemo(
    () => activity.map((log) => ({ log, described: describeActivity(log), failed: log.status >= 400 })),
    [activity],
  );
  const changeCount = describedActivity.filter((e) => e.described.kind === "change").length;
  const failedCount = describedActivity.filter((e) => e.failed).length;

  const filteredActivity = React.useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return describedActivity.filter(({ log, described, failed }) => {
      if (activityFilter === "changes" && described.kind !== "change") return false;
      if (activityFilter === "failed" && !failed) return false;
      if (activityFilter === "all" && described.kind === "background") return false;
      if (!q) return true;
      return described.title.toLowerCase().includes(q) || (log.userEmail ?? "").toLowerCase().includes(q);
    });
  }, [describedActivity, activitySearch, activityFilter]);

  const togglePermission = (id: number, checked: boolean) => {
    setSelectedPermissions((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((value) => value !== id);
    });
  };

  const setGroup = (items: PermissionRecord[], checked: boolean) => {
    const ids = new Set(items.map((p) => p.id));
    setSelectedPermissions((current) => (checked ? Array.from(new Set([...current, ...ids])) : current.filter((id) => !ids.has(id))));
  };

  const openCreate = () => {
    setEditingRole(null);
    setName("");
    setDescription("");
    setSelectedPermissions([]);
    setOpen(true);
  };

  const openEdit = (role: RoleRecord) => {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelectedPermissions((role.permissions ?? []).map((p) => p.id));
    setOpen(true);
  };

  const handleSaveRole = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        const updated = await updateRole(editingRole.id, {
          name: name.trim(),
          description: description.trim(),
          permission_ids: selectedPermissions,
        });
        setRoles((current) => current.map((r) => (r.id === updated.id ? updated : r)));
        toast.success("Role updated");
      } else {
        const role = await createRole({
          name: name.trim(),
          description: description.trim() || undefined,
          permission_ids: selectedPermissions,
        });
        setRoles((current) => [...current, role]);
        toast.success("Role created successfully");
      }
      setOpen(false);
      setEditingRole(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHero
        tone="terracotta"
        icon={Shield}
        eyebrow="People & access"
        title={<>Roles &amp; <strong className="font-semibold">permissions</strong></>}
        description="Define access levels and security permissions for your team."
        actions={
          <HeroAction variant="primary" icon={Plus} onClick={openCreate}>
            Create role
          </HeroAction>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Roles" value={roles.length} hint="Access levels defined" icon={Shield} accent="terracotta" loading={loading} />
          <GlassStat label="Permissions" value={permissions.length} hint="Things a role can allow" icon={KeyRound} accent="lavender" loading={loading} />
          <GlassStat label="Active users" value={users.filter((u) => u.status.toLowerCase() === "active").length} hint="Assigned to a role" icon={UserCheck} accent="sage" loading={loading} />
          <GlassStat
            label="Unused roles"
            value={roles.filter((r) => roleUserCount(r, users) === 0).length}
            hint="No active users yet"
            icon={ShieldAlert}
            accent="amber"
            loading={loading}
          />
        </div>
      </PageHero>

      {loading ? (
        <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-[26px] bg-white ring-1 ring-border/50 dark:bg-card" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-[26px] bg-[#F8E4E0] p-5 text-sm text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200">
          <p>{error}</p>
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
          {/* Toolbar */}
          <div className={cn(CARD, "flex flex-col gap-3 p-4 lg:flex-row lg:items-center")}>
            <div className="relative flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search roles or permissions"
                placeholder="Search roles or permissions…"
                className={cn(FIELD, "pl-10")}
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
              />
            </div>
            <Segmented<RoleFilter>
              label="Filter roles"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: "All roles" },
                { value: "assigned", label: "Has users" },
                { value: "unassigned", label: "No users" },
              ]}
            />
            <div className="relative">
              <select
                aria-label="Sort roles"
                value={roleSort}
                onChange={(e) => setRoleSort(e.target.value as RoleSort)}
                className="h-11 w-full appearance-none rounded-full bg-[#F3F1EA] pr-9 pl-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-44 dark:bg-muted"
              >
                <option value="name">Sort: Name</option>
                <option value="users">Sort: Users</option>
                <option value="permissions">Sort: Permissions</option>
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            {hasRoleFilters ? (
              <button
                type="button"
                onClick={() => {
                  setRoleSearch("");
                  setRoleFilter("all");
                }}
                className="flex h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground lg:self-auto dark:hover:bg-muted"
              >
                <X aria-hidden="true" className="size-4" />
                Clear
              </button>
            ) : null}
          </div>

          {/* Roles */}
          {filteredRoles.length === 0 ? (
            <div className={cn(CARD, "flex flex-col items-center gap-3 px-6 py-14 text-center")}>
              <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                <Shield aria-hidden="true" className="size-5 text-muted-foreground" />
              </span>
              <div>
                <p className="font-medium">{hasRoleFilters ? "No roles match your filters" : "No roles yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasRoleFilters ? "Try a different search or clear the filters." : "Create a role to start grouping permissions for your team."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRoles.map((role) => (
                <RoleCard key={role.id} role={role} userCount={roleUserCount(role, users)} totalByGroup={groupedPermissions} onEdit={() => openEdit(role)} />
              ))}
            </div>
          )}

          {/* Activity */}
          <section aria-labelledby="role-activity-title" className="space-y-3 pt-3">
            <div>
              <h2 id="role-activity-title" className="text-lg font-medium tracking-[-0.01em]">
                Recent role activity
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Latest changes and access events related to roles and permissions.</p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search activity"
                  placeholder="Search activity or person…"
                  className={cn(FIELD, "bg-white pl-10 ring-1 ring-border/50 dark:bg-card")}
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                />
              </div>
              <Segmented<ActivityFilter>
                label="Filter activity"
                value={activityFilter}
                onChange={setActivityFilter}
                options={[
                  { value: "changes", label: "Changes", count: changeCount },
                  { value: "all", label: "All events" },
                  { value: "failed", label: "Failed", count: failedCount, disabled: failedCount === 0 },
                ]}
              />
            </div>

            {filteredActivity.length === 0 ? (
              <div className={cn(CARD, "px-6 py-12 text-center")}>
                <p className="font-medium">{activitySearch.trim() ? "No activity matches your search" : activityFilter === "changes" ? "No role changes recorded yet" : "No role activity recorded yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activityFilter === "changes" && activity.length > 0 ? "Switch to All events to see who has opened this page." : "Creating or editing a role will show up here."}
                </p>
              </div>
            ) : (
              <>
                <ul className={cn(CARD, "divide-y divide-border/50 overflow-hidden")}>
                  {filteredActivity.slice(0, activityShown).map(({ log, described, failed }) => (
                    <li key={log.id} className="flex items-center gap-3 px-5 py-3.5" title={`${log.method} ${log.path}`}>
                      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", failed ? "bg-[#B94A3E]" : described.kind === "change" ? "bg-primary" : "bg-[#C9C5B8] dark:bg-zinc-600")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className={cn(described.kind === "change" && "font-medium")}>{described.title}</span>
                          {failed ? <span className="ml-2 rounded-full bg-[#F8E4E0] px-2 py-0.5 text-[11px] font-medium text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200">Failed</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{log.userEmail || "System"}</p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={log.createdAt}>
                        {formatRelative(log.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
                {filteredActivity.length > activityShown ? (
                  <button
                    type="button"
                    onClick={() => setActivityShown((n) => n + ACTIVITY_STEP)}
                    className="mx-auto flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                  >
                    Show {Math.min(ACTIVITY_STEP, filteredActivity.length - activityShown)} more
                    <span className="ml-1.5 text-muted-foreground">· {filteredActivity.length - activityShown} left</span>
                  </button>
                ) : null}
              </>
            )}
          </section>
        </>
      )}

      {/* Create / edit */}
      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="flex max-h-[90vh] flex-col rounded-[26px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit ${editingRole.name}` : "Create role"}</DialogTitle>
            <DialogDescription>Define a role name, describe its purpose, and choose what it can do.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-1.5">
              <label htmlFor="role-name" className="px-1 text-[13px] font-medium">
                Role name
              </label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead Reviewer" className={cn(FIELD, "pl-3.5")} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="role-description" className="px-1 text-[13px] font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can review exams and approve final reports."
                className="min-h-20 rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-sm shadow-none dark:bg-muted"
              />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-medium">Permissions</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selectedPermissions.length} of {permissions.length} selected
                </span>
              </div>
              {groupedPermissions.map(([group, items]) => {
                const selectedInGroup = items.filter((p) => selectedPermissions.includes(p.id)).length;
                const allSelected = selectedInGroup === items.length;
                return (
                  <section key={group} aria-label={group} className="overflow-hidden rounded-2xl bg-[#F7F6F1] dark:bg-muted/40">
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <h3 className="text-sm font-medium">
                        {group} <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">{selectedInGroup}/{items.length}</span>
                      </h3>
                      <button type="button" onClick={() => setGroup(items, !allSelected)} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                        {allSelected ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <ul className="divide-y divide-border/40 border-t border-border/40 bg-white dark:bg-card">
                      {items.map((permission) => (
                        <li key={permission.id}>
                          <PermissionSwitch permission={permission} checked={selectedPermissions.includes(permission.id)} onChange={(checked) => togglePermission(permission.id, checked)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveRole()}
              disabled={saving || !name.trim()}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : editingRole ? "Save changes" : "Create role"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RoleCard({
  role,
  userCount,
  totalByGroup,
  onEdit,
}: {
  role: RoleRecord;
  userCount: number;
  totalByGroup: Array<[string, PermissionRecord[]]>;
  onEdit: () => void;
}) {
  const granted = role.permissions ?? [];
  const total = totalByGroup.reduce((n, [, items]) => n + items.length, 0);
  const grantedGroups = groupPermissions(granted);
  const totalFor = (group: string) => totalByGroup.find(([g]) => g === group)?.[1].length ?? 0;

  return (
    <article className={cn(CARD, "flex flex-col gap-4 p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground">
            <Shield aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium" title={role.name}>
              {role.name}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Users aria-hidden="true" className="size-3.5 shrink-0" />
              {userCount} active {userCount === 1 ? "user" : "users"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${role.name}`}
          title={`Edit ${role.name}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edit
        </button>
      </div>

      <p className={cn("line-clamp-2 min-h-10 text-sm", role.description ? "text-foreground/80" : "text-muted-foreground")}>
        {role.description || "No description yet."}
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`${role.name} permissions`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={granted.length}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECE9E0] dark:bg-muted"
          >
            <div className="h-full rounded-full bg-[#30302E] dark:bg-secondary" style={{ width: total ? `${(granted.length / total) * 100}%` : "0%" }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {granted.length}/{total} permissions
          </span>
        </div>

        {grantedGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground">No permissions attached.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {grantedGroups.map(([group, items]) => (
              <li key={group} className="rounded-full bg-[#ECE9E0] px-2.5 py-1 text-xs font-medium text-[#3D3929] dark:bg-muted dark:text-foreground">
                {group} <span className="tabular-nums opacity-70">{items.length}/{totalFor(group) || items.length}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function PermissionSwitch({ permission, checked, onChange }: { permission: PermissionRecord; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {permissionLabel(permission)}
        </label>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{permission.name}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
        )}
      >
        <span aria-hidden="true" className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}
