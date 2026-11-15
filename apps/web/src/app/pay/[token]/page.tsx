"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Lock, AlertTriangle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type PayLinkState =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "paid"; code: string }
  | { kind: "error"; message: string };

/**
 * The short link clients receive (…/pay/k3j9xq2mpa). It asks the API for the live Stripe
 * page — making a fresh one if the last expired — and forwards the client there.
 */
export default function PayLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [state, setState] = React.useState<PayLinkState>({ kind: "loading" });

  const open = React.useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`${API_BASE}/api/public/pay/${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ kind: "error", message: data?.error || "This payment link could not be opened." });
        return;
      }
      if (data?.status === "paid") {
        setState({ kind: "paid", code: data.code || "" });
        return;
      }
      if (data?.status === "open" && typeof data.url === "string" && data.url.startsWith("https://")) {
        setState({ kind: "redirecting" });
        window.location.replace(data.url);
        return;
      }
      setState({ kind: "error", message: "This payment link could not be opened." });
    } catch {
      setState({ kind: "error", message: "We couldn't reach the payment service. Check your connection and try again." });
    }
  }, [token]);

  React.useEffect(() => {
    void open();
  }, [open]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F1EA] px-6 dark:bg-background">
      <div className="w-full max-w-sm rounded-[26px] bg-white p-8 text-center shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        {state.kind === "loading" || state.kind === "redirecting" ? (
          <>
            <Loader2 aria-hidden="true" className="mx-auto size-8 animate-spin text-muted-foreground" />
            <h1 className="mt-5 text-xl font-medium tracking-[-0.01em]">Opening secure payment…</h1>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Lock aria-hidden="true" className="size-3.5" />
              Card payments are handled by Stripe.
            </p>
          </>
        ) : state.kind === "paid" ? (
          <>
            <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-[#2D5A27] dark:text-emerald-400" />
            <h1 className="mt-5 text-xl font-medium tracking-[-0.01em]">This payment is complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.code ? `We've received payment for invoice ${state.code}. ` : "We've received this payment. "}
              There's nothing more to pay on this link.
            </p>
          </>
        ) : (
          <>
            <AlertTriangle aria-hidden="true" className="mx-auto size-9 text-[#8A5A12] dark:text-amber-300" />
            <h1 className="mt-5 text-xl font-medium tracking-[-0.01em]">Payment link unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <button
              type="button"
              onClick={() => void open()}
              className="mt-6 h-11 rounded-full bg-[#2B2A27] px-6 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935]"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </main>
  );
}
