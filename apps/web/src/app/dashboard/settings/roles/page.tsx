"use client";

import * as React from "react";
import { CheckCircle2, Plus, Shield } from "lucide-react";
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
import { fetchAuditLogs, type AuditLogRecord } from "@/lib/audit-logs";
import { fetchUsers, type UserRecord } from "@/lib/users";
import {
  createRole,
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

export default function RolesPage() {
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [activity, setActivity] = React.useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedPermissions, setSelectedPermissions] = React.useState<number[]>([]);
  const groupedPermissions = React.useMemo(() => groupPermissions(permissions), [permissions]);

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

  const togglePermission = (id: number, checked: boolean) => {
    setSelectedPermissions((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((value) => value !== id);
    });
  };

  const handleCreateRole = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setCreating(true);
    try {
      const role = await createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permission_ids: selectedPermissions,
      });
      setRoles((current) => [...current, role]);
      setOpen(false);
      setName("");
      setDescription("");
      setSelectedPermissions([]);
      toast.success("Role created successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role");
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
        <Button className="gap-2" onClick={() => setOpen(true)}>
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
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role) => {
              const assignedUsers = roleUserCount(role, users);
              const previewPermissions = (role.permissions || []).slice(0, 4);
              return (
                <Card key={role.id} className="relative overflow-hidden group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Shield className="h-5 w-5" />
                      <CardTitle className="text-base">{role.name}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      {assignedUsers} active user{assignedUsers === 1 ? "" : "s"} assigned
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
                        previewPermissions.map((permission) => (
                          <Badge key={permission.id} variant="outline">
                            {permissionLabel(permission)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Role Activity</CardTitle>
              <CardDescription>
                Latest changes and access events related to roles and permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="text-sm text-muted-foreground">No role activity recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {activity.slice(0, 8).map((log) => (
                    <div key={log.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-medium">{log.action}</div>
                        <Badge variant={log.status >= 400 ? "warning" : "success"}>{log.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{log.userEmail || "System"} · {formatRelative(log.createdAt)}</div>
                    </div>
                  ))}
                </div>
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
              <Button variant="outline" onClick={() => setOpen(true)}>Create Custom Role</Button>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>
              Define a role name, describe its purpose, and attach permissions.
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
            <Button onClick={handleCreateRole} disabled={creating}>
              {creating ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
