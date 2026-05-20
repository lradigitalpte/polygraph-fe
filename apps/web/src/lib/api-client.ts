/**
 * API client helper that automatically attaches the JWT token to requests.
 * Queries better-auth's /get-session endpoint for the JWT token.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? "http://localhost:8080/api/auth";

// Cache for the token to avoid repeated async calls during the same request
let cachedToken: string | null = null;
let cachedEmail: string | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL = 5000; // 5 seconds
let pendingSessionRequest: Promise<{ token: string | null; email: string | null }> | null = null;
async function getTokenFromSession(): Promise<{ token: string | null; email: string | null }> {
  if (pendingSessionRequest) {
    return pendingSessionRequest;
  }

  pendingSessionRequest = (async () => {
  try {
    if (process.env.NODE_ENV === "development") {
      console.debug("[getTokenFromSession] Fetching session from", AUTH_URL);
    }

    const res = await fetch(`${AUTH_URL}/get-session`, {
      credentials: "include", // Send cookies
    });

    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getTokenFromSession] Failed to get session:", res.status);
      }
      return { token: null, email: null };
    }

    const data = await res.json();
    if (process.env.NODE_ENV === "development") {
      console.debug("[getTokenFromSession] Session data:", Object.keys(data));
    }

    // Extract token and email from session response
    let token: string | null = null;
    let email: string | null = null;

    // better-auth typically returns a session object with user and token fields
    if (data?.token) token = data.token;
    if (data?.session?.token) token = data.session.token;
    if (data?.user?.email) email = data.user.email;
    if (data?.email) email = data.email;

    if (process.env.NODE_ENV === "development") {
      console.debug("[getTokenFromSession] Extracted token:", !!token, "email:", email);
    }

    return { token, email };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getTokenFromSession] Error:", err);
    }
    return { token: null, email: null };
  } finally {
    pendingSessionRequest = null;
  }
  })();

  return pendingSessionRequest;
}

/**
 * Get the session token and user email from better-auth.
 * Tries multiple methods:
 * 1. Query better-auth's /get-session endpoint
 * 2. Read from localStorage and cookies
 */
async function getToken(): Promise<{ token: string | null; email: string | null }> {
  const now = Date.now();
  if (cachedToken && now - tokenCacheTime < TOKEN_CACHE_TTL) {
    return { token: cachedToken, email: cachedEmail };
  }

  // Try getting token + email from session endpoint
  const data = await getTokenFromSession();
  if (data.token) {
    cachedToken = data.token;
    cachedEmail = data.email;
    tokenCacheTime = now;
    return data;
  }

  // Fallback: try localStorage and cookies
  const token = getTokenFromStorage();
  if (token) {
    cachedToken = token;
    cachedEmail = null;
    tokenCacheTime = now;
    return { token, email: null };
  }

  cachedToken = null;
  cachedEmail = null;
  tokenCacheTime = 0;

  if (process.env.NODE_ENV === "development") {
    console.warn("[getToken] No token found");
  }
  return { token: null, email: null };
}

/**
 * Get the JWT token from browser storage (localStorage or cookies).
 * Fallback method if session endpoint is not available.
 */
function getTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;

  try {
    // ===== Try localStorage first =====
    const possibleKeys = [
      "better-auth.session",
      "auth.session",
      "session",
      "better-auth",
      "auth",
    ];

    for (const key of possibleKeys) {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (process.env.NODE_ENV === "development") {
            console.debug(`[getTokenFromStorage] Found key "${key}":`, typeof data);
          }

          // If it's directly a JWT string
          if (typeof data === "string" && data.includes(".")) {
            return data;
          }

          // Check common object structures
          if (data?.token) return data.token;
          if (data?.session?.token) return data.session.token;
          if (data?.accessToken) return data.accessToken;
          if (data?.access_token) return data.access_token;

          // Check for nested JWT strings
          const findJWT = (obj: any): string | null => {
            if (typeof obj === "string" && obj.includes(".") && obj.split(".").length === 3) {
              return obj;
            }
            if (obj && typeof obj === "object") {
              for (const value of Object.values(obj)) {
                const result = findJWT(value);
                if (result) return result;
              }
            }
            return null;
          };

          const found = findJWT(data);
          if (found) return found;
        } catch {
          // Continue to next key
        }
      }
    }

    // ===== Scan localStorage for any JWT-like tokens =====
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        const value = window.localStorage.getItem(key);
        if (value && value.includes(".") && value.split(".").length === 3) {
          if (process.env.NODE_ENV === "development") {
            console.debug(`[getTokenFromStorage] Found JWT in localStorage key "${key}"`);
          }
          return value;
        }
      }
    }

    // ===== Try reading from cookies as fallback =====
    const cookieStr = document.cookie;
    if (cookieStr) {
      const cookies = cookieStr.split(";").map(c => c.trim());
      const possibleCookieNames = [
        "better-auth.session_token",
        "session_token",
        "authjs.session-token",
        "auth",
      ];

      for (const name of possibleCookieNames) {
        const cookie = cookies.find(c => c.startsWith(name + "="));
        if (cookie) {
          const value = cookie.substring(name.length + 1);
          if (value && value.includes(".") && value.split(".").length === 3) {
            if (process.env.NODE_ENV === "development") {
              console.debug(`[getTokenFromStorage] Found JWT in cookie "${name}"`);
            }
            return decodeURIComponent(value);
          }
        }
      }

      // Scan all cookies for JWT-like values
      for (const cookie of cookies) {
        const [name, value] = cookie.split("=");
        if (value && value.includes(".") && value.split(".").length === 3) {
          if (process.env.NODE_ENV === "development") {
            console.debug(`[getTokenFromStorage] Found JWT in cookie "${name}"`);
          }
          return decodeURIComponent(value);
        }
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[getTokenFromStorage] Available localStorage keys:", 
        Array.from({ length: window.localStorage.length }).map((_, i) => window.localStorage.key(i))
      );
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getTokenFromStorage] Error:", e);
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[getTokenFromStorage] No token found in localStorage or cookies");
  }
  return null;
}

/**
 * Make an authenticated fetch request with automatic JWT bearer token and user email header.
 * Queries better-auth's /get-session endpoint to get both the token and user email.
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const { token, email } = await getToken();
  const headers = new Headers(options.headers);

  // Set content-type default (skip for FormData so the browser sets multipart boundary)
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach bearer token if available
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    if (process.env.NODE_ENV === "development") {
      console.debug("[authenticatedFetch] Attaching token to request:", endpoint);
    }
  }

  // Attach user email as header for session token validation
  if (email) {
    headers.set("X-User-Email", email);
    if (process.env.NODE_ENV === "development") {
      console.debug("[authenticatedFetch] Attaching user email:", email);
    }
  }

  if (!token && process.env.NODE_ENV === "development") {
    console.warn("[authenticatedFetch] No token found, sending request with credentials:", endpoint);
  }

  // Use credentials: 'include' to send cookies with cross-origin requests
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include", // Always include cookies
    headers,
  });
}
