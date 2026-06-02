"use client";

import * as React from "react";

import { authClient } from "@/lib/auth-client";
import type { UserRecord } from "@/lib/users";
import { fetchMe, fetchMyPermissions } from "@/lib/account";

type CurrentUserData = {
  email: string;
  user: UserRecord;
  permissions: string[];
};

// Module-level cache shared by EVERY useCurrentUser() consumer (sidebar, top nav,
// pages). Without this, each component independently fetches session + /api/me +
// /api/me/permissions on every page — the cause of the slow, flickery nav load.
let cache: CurrentUserData | null = null;
let inflight: Promise<CurrentUserData | null> | null = null;

/** Clear the shared user cache — call on sign-out so the next user isn't stale. */
export function clearCurrentUserCache() {
  cache = null;
  inflight = null;
}

async function loadCurrentUser(): Promise<CurrentUserData | null> {
  const session = await authClient.getSession();
  const email = session?.data?.user?.email ?? "";
  if (!email) return null;
  if (cache && cache.email === email) return cache;

  try {
    const [me, perms] = await Promise.all([fetchMe(), fetchMyPermissions()]);
    cache = { email, user: me, permissions: perms };
    return cache;
  } catch {
    // Backend unreachable — fall back to basic session info (no permissions).
    // Not cached, so it retries on the next mount.
    const name = session?.data?.user?.name ?? email;
    return {
      email,
      user: {
        id: 0,
        name: name || email,
        email,
        status: "active",
        role_id: 0,
        password_reset_required: false,
        created_at: "",
        updated_at: "",
      },
      permissions: [],
    };
  }
}

/** De-duped fetch — concurrent callers share one in-flight request. */
function getCurrentUser(): Promise<CurrentUserData | null> {
  if (inflight) return inflight;
  inflight = loadCurrentUser().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Current user record, role & effective permissions — fetched once, shared everywhere. */
export function useCurrentUser() {
  // Initialise from the shared cache so a warm nav renders instantly (no flicker).
  const [user, setUser] = React.useState<UserRecord | null>(cache?.user ?? null);
  const [permissions, setPermissions] = React.useState<string[]>(cache?.permissions ?? []);
  const [loading, setLoading] = React.useState(!cache);

  React.useEffect(() => {
    if (cache) {
      setUser(cache.user);
      setPermissions(cache.permissions);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getCurrentUser()
      .then((data) => {
        if (cancelled || !data) return;
        setUser(data.user);
        setPermissions(data.permissions);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
