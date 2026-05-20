"use client";

import * as React from "react";

import { authClient } from "@/lib/auth-client";
import type { UserRecord } from "@/lib/users";

/** Nav display name/email from Better Auth session only (no /api/me on every page). */
export function useCurrentUser() {
  const [user, setUser] = React.useState<UserRecord | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const session = await authClient.getSession();
        const email = session?.data?.user?.email ?? "";
        const name = session?.data?.user?.name ?? email;
        if (!cancelled && email) {
          setUser({
            id: 0,
            name: name || email,
            email,
            status: "active",
            role_id: 0,
            password_reset_required: false,
            created_at: "",
            updated_at: "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}

export function userInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
