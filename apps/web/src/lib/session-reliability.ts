export type LogoutReason = "idle_timer" | "session_expired" | "missing_cookie" | "backend_401" | "manual";

const LOGOUT_REASON_KEY = "polygraph:last-logout-reason";

export function recordLogoutReason(reason: LogoutReason) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOGOUT_REASON_KEY, JSON.stringify({ reason, at: new Date().toISOString(), path: window.location.pathname }));
}

export function consumeLogoutReason(): LogoutReason | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOGOUT_REASON_KEY);
  window.localStorage.removeItem(LOGOUT_REASON_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw).reason as LogoutReason; } catch { return null; }
}
