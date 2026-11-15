"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, Link2Off, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { AUTH_BUTTON, AuthHeading, AuthNotice, AuthShell, PasswordField } from "@/components/auth/auth-shell";

const MIN_LENGTH = 8; // matches emailAndPassword.minPasswordLength in lib/auth.ts

function strength(pw: string) {
  let score = 0;
  if (pw.length >= MIN_LENGTH) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < MIN_LENGTH) return { score: Math.min(score, 1), label: "Too short", tone: "bg-destructive" };
  if (score <= 2) return { score, label: "Weak", tone: "bg-[#E0A33A]" };
  if (score === 3) return { score, label: "Good", tone: "bg-[#8FB98A]" };
  return { score, label: "Strong", tone: "bg-[#5FA86C]" };
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(searchParams.get("token"));
    // better-auth redirects here with ?error=INVALID_TOKEN when the link is bad or used.
    if (searchParams.get("error")) setToken(null);
  }, [searchParams]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => router.push("/login"), 2500);
    return () => window.clearTimeout(t);
  }, [done, router]);

  const s = strength(password);
  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = longEnough && matches && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmit) return;
    setError(null);
    setIsLoading(true);
    try {
      const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
      if (resetError) {
        const m = (resetError.message || "").toLowerCase();
        if (m.includes("token") || m.includes("expired") || m.includes("invalid")) setToken(null);
        else setError(resetError.message || "We couldn't update your password. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (token === undefined) {
    return <Loader2 aria-label="Loading" className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }

  if (done) {
    return (
      <>
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </span>
        <AuthHeading title="Password updated" subtitle="You can now sign in with your new password. Taking you there…" />
        <Link href="/login" className={AUTH_BUTTON}>
          Go to sign in
        </Link>
      </>
    );
  }

  if (!token) {
    return (
      <>
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Link2Off aria-hidden="true" className="size-6" />
        </span>
        <AuthHeading title="This link doesn't work anymore" subtitle="Reset links expire after a while and can only be used once. Ask for a fresh one — it only takes a moment." />
        <Link href="/forgot-password" className={AUTH_BUTTON}>
          Send me a new link
        </Link>
        <Link href="/login" className="mt-6 block text-center text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Set a new password" subtitle="Choose something you haven't used here before." />
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-1.5">
          <PasswordField id="password" autoComplete="new-password" placeholder="New password" value={password} onChange={setPassword} disabled={isLoading} describedBy="password-strength" />
          <div id="password-strength" className="px-4 pt-1" aria-live="polite">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", password && i < Math.max(1, s.score - 1) ? s.tone : "bg-border")} />
              ))}
            </div>
            <p className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span className={cn("flex items-center gap-1", longEnough && "text-[#2D5A27] dark:text-emerald-300")}>
                {longEnough ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
                At least {MIN_LENGTH} characters
              </span>
              {password ? <span className="font-medium">{s.label}</span> : null}
            </p>
          </div>
        </div>
        <div className="grid gap-1.5">
          <PasswordField
            id="confirm-password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isLoading}
            invalid={confirmPassword.length > 0 && !matches}
            describedBy="confirm-hint"
          />
          {confirmPassword ? (
            <p id="confirm-hint" className={cn("px-4 text-xs font-medium", matches ? "text-[#2D5A27] dark:text-emerald-300" : "text-destructive")}>
              {matches ? "Passwords match" : "Passwords don't match yet"}
            </p>
          ) : null}
        </div>
        <button type="submit" className={AUTH_BUTTON} disabled={!canSubmit}>
          {isLoading ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Updating…
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell panelTitle="Almost there" panelText="Pick a new password and you'll be back in your workspace in a moment.">
      <Suspense fallback={<Loader2 aria-label="Loading" className="mx-auto size-6 animate-spin text-muted-foreground" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
