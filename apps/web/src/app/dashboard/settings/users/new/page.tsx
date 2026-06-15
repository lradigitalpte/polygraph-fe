"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createUser, fetchRoles, type RoleRecord } from "@/lib/users";

const ROLE_META: Record<string, { description: string; color: string }> = {
  Admin: { description: "Full system access including billing and audit logs", color: "text-rose-500" },
  Examiner: { description: "Access to assigned exams, calendar, and subject profiles", color: "text-sky-500" },
  User: { description: "Basic read-only access to assigned resources", color: "text-emerald-500" },
};

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [rolesLoading, setRolesLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [roleId, setRoleId] = React.useState("");

  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const roleMeta = selectedRole ? ROLE_META[selectedRole.name] : null;

  const passwordStrength = React.useMemo(() => {
    if (!password) return null;
    if (password.length < 8) return { label: "Too short", color: "bg-rose-500", width: "w-1/4" };
    if (password.length < 10) return { label: "Weak", color: "bg-amber-500", width: "w-2/4" };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: "Fair", color: "bg-yellow-400", width: "w-3/4" };
    return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
  }, [password]);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await fetchRoles();
        if (!mounted) return;
        setRoles(data);
        if (data[0]) setRoleId(String(data[0].id));
      } catch (err) {
        if (mounted) toast.error(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        if (mounted) setRolesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !roleId || !password) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const authRes = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const authPayload = await authRes.json().catch(() => null);
      if (!authRes.ok) {
        throw new Error(authPayload?.error || "Failed to create auth account");
      }

      const user = await createUser({
        name: name.trim(),
        email: email.trim(),
        role_id: Number(roleId),
      });

      if (authPayload?.emailWarning) {
        toast.warning(
          `${name.trim()} created, but the set-password email failed: ${authPayload.emailWarning}. Share the temporary password instead.`
        );
      } else {
        toast.success(
          `${name.trim()} created — a set-password email has been sent to ${email.trim()}.`
        );
      }
      router.push(`/dashboard/settings/users/${user.id}` as Route);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" render={<Link href="/dashboard/settings/users" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="text-lg font-semibold">Create New User</h3>
          <p className="text-sm text-muted-foreground">Set up credentials and assign a role before the person signs in.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identity */}
        <Card className="border-border/70">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Identity</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email Address
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card className="border-border/70">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Temporary Password</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordStrength && (
                <div className="space-y-1">
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${passwordStrength.color} ${passwordStrength.width}`} />
                  </div>
                  <p className={`text-xs font-medium ${passwordStrength.color.replace("bg-", "text-")}`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">The user can change this after signing in via Profile → Security.</p>
            </div>
          </CardContent>
        </Card>

        {/* Role */}
        <Card className="border-border/70">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Access Role</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="role">Assigned Role</Label>
              <Select value={roleId} onValueChange={(v) => setRoleId(String(v))} disabled={rolesLoading}>
                <SelectTrigger id="role">
                  <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role"}>
                    {selectedRole?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleMeta && (
                <div className="flex items-start gap-2 rounded border border-border/70 bg-muted/30 px-3 py-2">
                  <Badge variant="outline" className={`mt-0.5 shrink-0 rounded-none text-[11px] ${roleMeta.color}`}>
                    {selectedRole?.name}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{roleMeta.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={loading || rolesLoading} className="min-w-32">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create User"
            )}
          </Button>
          <Button variant="outline" type="button" render={<Link href="/dashboard/settings/users" />}>
            Cancel
          </Button>
          <p className="ml-auto text-xs text-muted-foreground hidden sm:block">
            User can sign in at <span className="font-medium">/login</span> immediately after creation.
          </p>
        </div>
      </form>
    </div>
  );
}
