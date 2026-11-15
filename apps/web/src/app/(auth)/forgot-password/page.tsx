"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AUTH_BUTTON, AuthHeading, AuthNotice, AuthShell, EmailField } from "@/components/auth/auth-shell";

const RESEND_SECONDS = 30;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Carry over the email typed on the sign-in page.
  useEffect(() => {
    const fromQuery = searchParams.get("email");
    if (fromQuery) setEmail(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const request = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: resetError } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(resetError.status === 429 ? "Too many requests. Wait a minute, then try again." : resetError.message || "We couldn't send the email. Please try again.");
        return;
      }
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <>
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <AuthHeading
          title="Check your inbox"
          subtitle={
            <>
              If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, a link to set a new password is on its way.
            </>
          }
        />
        <ul className="mb-8 space-y-2 rounded-2xl bg-white px-5 py-4 text-[13px] text-muted-foreground ring-1 ring-border/60 dark:bg-card">
          <li className="list-none">• The link works for a limited time and can only be used once.</li>
          <li className="list-none">• Nothing after a few minutes? Check spam or junk.</li>
          <li className="list-none">• Make sure this is the email your administrator set up.</li>
        </ul>
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        <button type="button" onClick={() => void request()} disabled={isLoading || cooldown > 0} className={AUTH_BUTTON}>
          {isLoading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the link again"}
        </button>
        <button type="button" onClick={() => setSent(false)} className="mt-3 w-full text-center text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Use a different email
        </button>
        <BackToSignIn />
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one." />
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void request();
        }}
        className="space-y-5"
      >
        <EmailField
          value={email}
          onChange={(v) => {
            setEmail(v);
            setError(null);
          }}
          disabled={isLoading}
          autoFocus
        />
        <button type="submit" className={AUTH_BUTTON} disabled={isLoading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}>
          {isLoading ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>
      <BackToSignIn />
    </>
  );
}

function BackToSignIn() {
  return (
    <Link href="/login" className="mt-8 flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in
    </Link>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell panelTitle="Locked out?" panelText="It happens. We'll email you a secure link so you can choose a new password.">
      <Suspense fallback={<Loader2 aria-label="Loading" className="mx-auto size-6 animate-spin text-muted-foreground" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
