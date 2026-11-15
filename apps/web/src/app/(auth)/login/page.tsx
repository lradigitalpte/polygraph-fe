"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { consumeLogoutReason } from "@/lib/session-reliability";
import { AUTH_BUTTON, AuthHeading, AuthNotice, AuthShell, EmailField, PasswordField } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

const LAST_EMAIL_KEY = "polygraph:last-sign-in-email";

/** Turn auth errors into something a person can act on. */
function friendlyError(message?: string, status?: number) {
  const m = (message || "").toLowerCase();
  if (status === 429 || m.includes("too many")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("verify") || m.includes("verified")) return "This account's email hasn't been verified yet. Check your inbox for the verification link.";
  if (m.includes("invalid") || m.includes("password") || m.includes("credential") || status === 401) return "That email and password don't match. Check them and try again.";
  return message || "We couldn't sign you in. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const reason = consumeLogoutReason();
    if (reason === "idle_timer") setNotice("You were signed out after 30 minutes of inactivity.");
    else if (reason === "session_expired") setNotice("Your session expired. Please sign in again.");
    else if (reason === "missing_cookie" || reason === "backend_401") setNotice("Your session couldn't be verified. Please sign in again.");
    try {
      const last = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (last) setEmail(last);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/dashboard", rememberMe: remember });
      if (signInError) {
        setError(friendlyError(signInError.message, signInError.status));
        setIsLoading(false);
        return;
      }
      try {
        if (remember) window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
        else window.localStorage.removeItem(LAST_EMAIL_KEY);
      } catch {
        /* storage unavailable */
      }
      router.push("/dashboard");
      // Keep the spinner while the dashboard loads.
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthHeading title="Hello!" subtitle="Sign in to your account" />

      {notice && !error ? <AuthNotice>{notice}</AuthNotice> : null}
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <EmailField
          value={email}
          onChange={(v) => {
            setEmail(v);
            setError(null);
          }}
          disabled={isLoading}
          invalid={Boolean(error)}
          autoFocus={!email}
        />

        <div>
          <PasswordField
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError(null);
            }}
            disabled={isLoading}
            invalid={Boolean(error)}
          />
          <div className="mt-3 flex items-center justify-between px-2 text-[13px]">
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={remember}
                onClick={() => setRemember((r) => !r)}
                className={cn(
                  "flex size-[18px] items-center justify-center rounded-[5px] transition-colors",
                  remember ? "bg-[#B4552F] text-white" : "bg-white ring-1 ring-border dark:bg-card",
                )}
              >
                {remember ? <Check aria-hidden="true" className="size-3" strokeWidth={3.5} /> : null}
              </button>
              Remember me
            </label>
            <Link href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="font-medium text-muted-foreground underline-offset-4 hover:text-[#B4552F] hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="pt-3">
          <button type="submit" className={AUTH_BUTTON} disabled={isLoading || !email.trim() || !password}>
            {isLoading ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-[13px] text-muted-foreground">Accounts are set up by your administrator.</p>
    </AuthShell>
  );
}
