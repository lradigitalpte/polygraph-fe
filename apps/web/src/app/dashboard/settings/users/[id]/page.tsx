"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Mail, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import {
  deleteUser,
  fetchRoles,
  fetchUser,
  fetchUserActivity,
  requirePasswordReset,
  type RoleRecord,
  type UserActivityRecord,
  type UserRecord,
  updateUserRole,
  updateUserStatus,
} from "@/lib/users";

function formatDateTime(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function formatAction(log: UserActivityRecord): string {
  const method = log.method.toUpperCase();
  if (method === "GET") return `Viewed ${log.path}`;
  if (method === "POST") return `Created or triggered ${log.path}`;
  if (method === "PATCH") return `Updated ${log.path}`;
  if (method === "DELETE") return `Deleted ${log.path}`;
  return log.action;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [user, setUser] = React.useState<UserRecord | null>(null);
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [activity, setActivity] = React.useState<UserActivityRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!id || Number.isNaN(id)) return;
    setLoading(true);
    setError(null);
    try {
      const [userData, roleData, activityData] = await Promise.all([
        fetchUser(id),
        fetchRoles(),
        fetchUserActivity(id, 25),
      ]);
      setUser(userData);
      setRoles(roleData);
      setActivity(activityData);
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
    if (!user) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/settings/users")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="text-lg font-medium">User Detail</h3>
          <p className="text-sm text-muted-foreground">Profile, access, security state, and activity history.</p>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading user...</CardContent></Card>
      ) : error || !user ? (
        <Card><CardContent className="pt-6 text-sm text-destructive">{error ?? "User not found"}</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xl font-semibold">{user.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={user.status === "active" ? "success" : user.status === "suspended" ? "destructive" : "warning"}>
                  {user.status}
                </Badge>
                <Badge variant="outline">{user.role?.name ?? "Unassigned"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="details" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 outline-none">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Core information and availability details.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <InfoRow label="Name" value={user.name} icon={<UserRound className="h-4 w-4" />} />
                  <InfoRow label="Email" value={user.email} icon={<Mail className="h-4 w-4" />} />
                  <InfoRow label="Role" value={user.role?.name ?? "Unassigned"} icon={<Shield className="h-4 w-4" />} />
                  <InfoRow label="Status" value={user.status} icon={<Clock3 className="h-4 w-4" />} />
                  <InfoRow label="Invited" value={formatDateTime(user.invited_at)} />
                  <InfoRow label="Last Active" value={formatDateTime(user.last_active_at)} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 outline-none">
              <Card>
                <CardHeader>
                  <CardTitle>Access Control</CardTitle>
                  <CardDescription>Change role, suspend access, or trigger password reset.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-2 max-w-md">
                    <label className="text-sm font-medium">Assigned Role</label>
                    <Select value={String(user.role_id)} onValueChange={(value) => void handleRoleChange(String(value))} disabled={saving}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2 max-w-md">
                    <label className="text-sm font-medium">Availability</label>
                    <Select value={user.status} onValueChange={(value) => void handleStatusChange(String(value))} disabled={saving}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handlePasswordReset} disabled={saving}>
                      Require Password Reset
                    </Button>
                    <Button variant="outline" render={<Link href="/dashboard/settings/users/new" />}>
                      Create Another User
                    </Button>
                  </div>

                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    Password reset required: <span className="font-medium text-foreground">{user.password_reset_required ? "Yes" : "No"}</span>
                    <br />
                    Reset requested: <span className="font-medium text-foreground">{formatDateTime(user.password_reset_sent_at)}</span>
                    <br />
                    Suspended at: <span className="font-medium text-foreground">{formatDateTime(user.suspended_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 outline-none">
              <Card>
                <CardHeader>
                  <CardTitle>User Activity</CardTitle>
                  <CardDescription>Most recent actions attributed to this user.</CardDescription>
                </CardHeader>
                <CardContent>
                  {activity.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No recorded activity yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {activity.map((log) => (
                        <div key={log.id} className="rounded-lg border p-4 space-y-1">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="font-medium">{formatAction(log)}</div>
                            <Badge variant={log.status >= 400 ? "warning" : "success"}>{log.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</div>
                          <div className="text-xs text-muted-foreground">{log.path}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Delete User</CardTitle>
              <CardDescription>
                Permanently remove this staff account and their sign-in. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteConfirmDialog
                title={`Delete ${user.name}`}
                description="The user will be removed from the system and will no longer be able to sign in."
                confirmLabel="Confirmation"
                triggerLabel="Delete User"
                onConfirm={async () => {
                  try {
                    await deleteUser(user.id);
                    toast.success("User deleted");
                    router.push("/dashboard/settings/users");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete user");
                    throw err;
                  }
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-medium">{value}</div>
    </div>
  );
}
