"use client";

import * as React from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, Search, Shield, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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

type RoleFilter = "all" | "assigned" | "unassigned";
type RoleSort = "name" | "users" | "permissions";
type ActivityFilter = "all" | "success" | "error";

const ROLES_PAGE_SIZES = [4, 6, 8] as const;
const ACTIVITY_PAGE_SIZES = [5, 10, 15] as const;

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizes,
  onPageChange,
  onPageSizeChange,
  label,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizes: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label: string;
}) {
  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)}
          </span>{" "}
          of {totalItems} {label}
        </p>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
            Per page
          </Label>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[72px] rounded-lg">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageNumbers.map((page, index) => {
            const prev = pageNumbers[index - 1];
            const showEllipsis = prev !== undefined && page - prev > 1;
            return (
              <React.Fragment key={page}>
                {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                <Button
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-8 w-8 rounded-lg text-xs font-black")}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              </React.Fragment>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [activity, setActivity] = React.useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RoleRecord | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<number[]>([]);
  const groupedPermissions = React.useMemo(() => groupPermissions(permissions), [permissions]);

  const [roleSearch, setRoleSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("all");
  const [roleSort, setRoleSort] = React.useState<RoleSort>("name");
  const [rolePage, setRolePage] = React.useState(1);
  const [rolesPerPage, setRolesPerPage] = React.useState<number>(6);

  const [activitySearch, setActivitySearch] = React.useState("");
  const [activityFilter, setActivityFilter] = React.useState<ActivityFilter>("all");
  const [activityPage, setActivityPage] = React.useState(1);
  const [activityPerPage, setActivityPerPage] = React.useState<number>(5);

  const hasRoleFilters = Boolean(roleSearch.trim()) || roleFilter !== "all";
  const hasActivityFilters = Boolean(activitySearch.trim()) || activityFilter !== "all";

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const [roleData, permissionData, userData, auditData] = await Promise.all([
          fetchRoles(),
          fetchPermissions(),
          fetchUsers(),
          fetchAuditLogs(100),
        ]);
        if (!mounted) return;
        setRoles(roleData);
        setPermissions(permissionData);
        setUsers(userData);
        setActivity(roleActivities(auditData));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    setRolePage(1);
  }, [roleSearch, roleFilter, roleSort, rolesPerPage]);

  React.useEffect(() => {
    setActivityPage(1);
  }, [activitySearch, activityFilter, activityPerPage]);

  const filteredRoles = React.useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    let rows = roles.filter((role) => {
      const assignedUsers = roleUserCount(role, users);
      const permissionText = (role.permissions || [])
        .map((p) => permissionLabel(p))
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !q ||
        role.name.toLowerCase().includes(q) ||
        (role.description ?? "").toLowerCase().includes(q) ||
        permissionText.includes(q);

      const matchesFilter =
        roleFilter === "all" ||
        (roleFilter === "assigned" && assignedUsers > 0) ||
        (roleFilter === "unassigned" && assignedUsers === 0);

      return matchesSearch && matchesFilter;
    });

    rows = [...rows].sort((a, b) => {
      if (roleSort === "users") {
        return roleUserCount(b, users) - roleUserCount(a, users);
      }
      if (roleSort === "permissions") {
        return (b.permissions?.length ?? 0) - (a.permissions?.length ?? 0);
      }
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [roles, users, roleSearch, roleFilter, roleSort]);

  const rolesTotalPages = Math.max(1, Math.ceil(filteredRoles.length / rolesPerPage));
  const paginatedRoles = filteredRoles.slice(
    (rolePage - 1) * rolesPerPage,
    rolePage * rolesPerPage,
  );

  React.useEffect(() => {
    if (rolePage > rolesTotalPages) {
      setRolePage(rolesTotalPages);
    }
  }, [rolePage, rolesTotalPages]);

  const filteredActivity = React.useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return activity.filter((log) => {
      const isError = log.status >= 400;
      const matchesFilter =
        activityFilter === "all" ||
        (activityFilter === "success" && !isError) ||
        (activityFilter === "error" && isError);

      if (!matchesFilter) return false;
      if (!q) return true;

      return (
        log.action.toLowerCase().includes(q) ||
        (log.userEmail ?? "").toLowerCase().includes(q) ||
        log.path.toLowerCase().includes(q) ||
        String(log.status).includes(q)
      );
    });
  }, [activity, activitySearch, activityFilter]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredActivity.length / activityPerPage));
  const paginatedActivity = filteredActivity.slice(
    (activityPage - 1) * activityPerPage,
    activityPage * activityPerPage,
  );

  React.useEffect(() => {
    if (activityPage > activityTotalPages) {
      setActivityPage(activityTotalPages);
    }
  }, [activityPage, activityTotalPages]);

  const togglePermission = (id: number, checked: boolean) => {
    setSelectedPermissions((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((value) => value !== id);
    });
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

    setCreating(true);
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
      setName("");
      setDescription("");
      setSelectedPermissions([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Define access levels and security permissions for your team.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading roles...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/40 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10 h-10 rounded-xl"
                placeholder="Search roles or permissions..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                <SelectTrigger className="h-10 w-[160px] rounded-xl">
                  <SelectValue>
                    {roleFilter === "all"
                      ? "All roles"
                      : roleFilter === "assigned"
                        ? "Has users"
                        : "No users"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="assigned">Has users assigned</SelectItem>
                  <SelectItem value="unassigned">No users assigned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleSort} onValueChange={(v) => setRoleSort(v as RoleSort)}>
                <SelectTrigger className="h-10 w-[160px] rounded-xl">
                  <SelectValue>
                    {roleSort === "name"
                      ? "Sort: Name"
                      : roleSort === "users"
                        ? "Sort: Users"
                        : "Sort: Permissions"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by name</SelectItem>
                  <SelectItem value="users">Sort by user count</SelectItem>
                  <SelectItem value="permissions">Sort by permissions</SelectItem>
                </SelectContent>
              </Select>
              {hasRoleFilters && (
                <Button
                  variant="ghost"
                  className="h-10 rounded-xl gap-1.5"
                  onClick={() => {
                    setRoleSearch("");
                    setRoleFilter("all");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {filteredRoles.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {hasRoleFilters ? "No roles match your filters." : "No roles found."}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {paginatedRoles.map((role) => {
              const assignedUsers = roleUserCount(role, users);
              const previewPermissions = (role.permissions || []).slice(0, 4);
              return (
                <Card key={role.id} className="relative overflow-hidden group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Shield className="h-5 w-5" />
                        <CardTitle className="text-base">{role.name}</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEdit(role)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      {assignedUsers} active user{assignedUsers === 1 ? "" : "s"} assigned · {(role.permissions || []).length} permission{(role.permissions || []).length === 1 ? "" : "s"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {role.description || "No description provided for this role yet."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewPermissions.length === 0 ? (
                        <Badge variant="outline">No permissions attached</Badge>
                      ) : (
                        <>
                          {previewPermissions.map((permission) => (
                            <Badge key={permission.id} variant="outline">
                              {permissionLabel(permission)}
                            </Badge>
                          ))}
                          {(role.permissions || []).length > previewPermissions.length && (
                            <Badge variant="secondary">
                              +{(role.permissions || []).length - previewPermissions.length} more
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
              </div>

              <PaginationBar
                currentPage={rolePage}
                totalPages={rolesTotalPages}
                totalItems={filteredRoles.length}
                pageSize={rolesPerPage}
                pageSizes={ROLES_PAGE_SIZES}
                onPageChange={setRolePage}
                onPageSizeChange={setRolesPerPage}
                label="roles"
              />
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Role Activity</CardTitle>
              <CardDescription>
                Latest changes and access events related to roles and permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10 h-10 rounded-xl"
                    placeholder="Search activity, user, or path..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={activityFilter}
                    onValueChange={(v) => setActivityFilter(v as ActivityFilter)}
                  >
                    <SelectTrigger className="h-10 w-[140px] rounded-xl">
                      <SelectValue>
                        {activityFilter === "all"
                          ? "All events"
                          : activityFilter === "success"
                            ? "Success"
                            : "Errors"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All events</SelectItem>
                      <SelectItem value="success">Success only</SelectItem>
                      <SelectItem value="error">Errors only</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActivityFilters && (
                    <Button
                      variant="ghost"
                      className="h-10 rounded-xl gap-1.5"
                      onClick={() => {
                        setActivitySearch("");
                        setActivityFilter("all");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {filteredActivity.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {hasActivityFilters ? "No activity matches your filters." : "No role activity recorded yet."}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedActivity.map((log) => (
                    <div key={log.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-medium">{log.action}</div>
                        <Badge variant={log.status >= 400 ? "warning" : "success"}>{log.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{log.userEmail || "System"} · {formatRelative(log.createdAt)}</div>
                    </div>
                  ))}
                  </div>

                  <PaginationBar
                    currentPage={activityPage}
                    totalPages={activityTotalPages}
                    totalItems={filteredActivity.length}
                    pageSize={activityPerPage}
                    pageSizes={ACTIVITY_PAGE_SIZES}
                    onPageChange={setActivityPage}
                    onPageSizeChange={setActivityPerPage}
                    label="events"
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-dashed border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-primary/40 mb-4" />
              <h4 className="font-bold">Need custom permissions?</h4>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Create roles with granular permission sets that match your organization workflow.
              </p>
              <Button variant="outline" onClick={openCreate}>Create Custom Role</Button>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit ${editingRole.name}` : "Create Role"}</DialogTitle>
            <DialogDescription>
              Define a role name, describe its purpose, and toggle its permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead Reviewer" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can review exams and approve final reports."
                className="min-h-24"
              />
            </div>
            <div className="grid gap-3">
              <Label>Permissions</Label>
              <div className="space-y-4 max-h-112 overflow-auto pr-1">
                {groupedPermissions.map(([group, items]) => (
                  <div key={group} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{group}</div>
                      <Badge variant="outline">{items.length}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {items.map((permission) => {
                        const checked = selectedPermissions.includes(permission.id);
                        return (
                          <label key={permission.id} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                            <Checkbox checked={checked} onCheckedChange={(value) => togglePermission(permission.id, Boolean(value))} />
                            <div>
                              <div className="text-sm font-medium">{permission.name}</div>
                              <div className="text-xs text-muted-foreground">{permission.description || "No description"}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={creating}>
              {creating ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
