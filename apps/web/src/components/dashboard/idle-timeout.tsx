"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

// Matches the better-auth session `expiresIn` (30 min). The server enforces expiry;
// this gives the user an immediate, visible logout instead of waiting for the next
// API call to fail.
const IDLE_MS = 30 * 60 * 1000;

/** Signs the user out after a period of no interaction, then redirects to login. */
export function IdleTimeout() {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const logout = async () => {
      try {
        await authClient.signOut();
      } catch {
        // ignore — we redirect regardless
      }
      toast.error("Signed out due to inactivity.");
      router.replace("/login");
    };

    const reset = () => {
      clearTimeout(timer);
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
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [router]);

  return null;
}
