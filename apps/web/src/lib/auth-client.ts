import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_NEON_AUTH_URL,
});

/**
 * Get the current session's JWT token.
 * Returns the raw session token if available.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const session = await authClient.getSession();
    if (session?.data) {
      // better-auth returns the session object with a token field
      return (session.data as any)?.token || null;
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[getSessionToken] Failed to get session:", e);
    }
  }
  return null;
}
