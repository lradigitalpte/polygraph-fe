"use client";

import * as React from "react";

import { authClient } from "@/lib/auth-client";
import type { UserRecord } from "@/lib/users";
import { fetchMe, fetchMyPermissions } from "@/lib/account";

/** Nav display name/email from Better Auth session + /api/me for full user record, role & effective permissions. */
export function useCurrentUser() {
  const [user, setUser] = React.useState<UserRecord | null>(null);
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const session = await authClient.getSession();
        const sessionEmail = session?.data?.user?.email ?? "";
        if (!cancelled && sessionEmail) {
          try {
            const [me, perms] = await Promise.all([fetchMe(), fetchMyPermissions()]);
            if (!cancelled) {
              setUser(me);
              setPermissions(perms);
            }
          } catch (err) {
            // Fallback to basic session info if /api/me fails
            const name = session?.data?.user?.name ?? sessionEmail;
            if (!cancelled) {
              setUser({
                id: 0,
                name: name || sessionEmail,
                email: sessionEmail,
                status: "active",
                role_id: 0,
                password_reset_required: false,
                created_at: "",
                updated_at: "",
              });
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const can = React.useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  return { user, loading, permissions, can };
}

export function userInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
