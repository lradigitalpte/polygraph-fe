"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, fetchRoles, type RoleRecord } from "@/lib/users";

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [rolesLoading, setRolesLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleId, setRoleId] = React.useState("");

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
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !roleId) {
      toast.error("Name, email, and role are required");
      return;
    }

    setLoading(true);
    try {
      const user = await createUser({
        name: name.trim(),
        email: email.trim(),
        role_id: Number(roleId),
      });
      toast.success("User created successfully.");
      router.push(`/dashboard/settings/users/${user.id}` as Route);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/settings/users" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="text-lg font-medium">Create New User</h3>
          <p className="text-sm text-muted-foreground">
            Create the user record and assign access before the person signs in.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <CardDescription>
            Creating this user stores them immediately with a pending status and assigned role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="j.doe@polygraph-labs.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Assigned Role</Label>
              <Select value={roleId} onValueChange={(value) => setRoleId(String(value))} disabled={rolesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role"} />
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

            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              What happens when you click Create User:
              <div className="mt-2">1. A user record is created in your organization.</div>
              <div>2. The selected role is attached immediately.</div>
              <div>3. The account starts in pending status until the user completes sign-in or you trigger reset/security actions from their profile.</div>
            </div>

            <div className="pt-4 flex gap-3">
              <Button className="flex-1" type="submit" disabled={loading || rolesLoading}>
                {loading ? "Creating..." : "Create User"}
              </Button>
              <Button variant="outline" type="button" render={<Link href="/dashboard/settings/users" />}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
