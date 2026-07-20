"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { recordLogoutReason } from "@/lib/session-reliability";

// Matches the better-auth session `expiresIn` (30 min). The server enforces expiry;
// this gives the user an immediate, visible logout instead of waiting for the next
// API call to fail.
const IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 25 * 60 * 1000;
const REFRESH_MS = 4 * 60 * 1000;

/** Signs the user out after a period of no interaction, then redirects to login. */
export function IdleTimeout() {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let warningTimer: ReturnType<typeof setTimeout>;
    let lastActivity = Date.now();

    const logout = async () => {
      recordLogoutReason("idle_timer");
      try {
        await authClient.signOut();
      } catch {
        // ignore — we redirect regardless
      }
      toast.error("Signed out due to inactivity.");
      router.replace("/login?reason=idle_timer");
    };

    const reset = () => {
      lastActivity = Date.now();
      clearTimeout(timer);
      clearTimeout(warningTimer);
      toast.dismiss("idle-warning");
      warningTimer = setTimeout(() => {
        toast.warning("You will be signed out in 5 minutes unless you continue working.", { id: "idle-warning", duration: 60_000 });
      }, WARNING_MS);
      timer = setTimeout(() => {
        void logout();
      }, IDLE_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden && Date.now() - lastActivity < REFRESH_MS + 30_000) void authClient.getSession();
    }, REFRESH_MS);
    reset();

    return () => {
      clearTimeout(timer);
      clearTimeout(warningTimer);
      window.clearInterval(refreshTimer);
      toast.dismiss("idle-warning");
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [router]);

  return null;
}
