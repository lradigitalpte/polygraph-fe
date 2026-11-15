"use client";

import * as React from "react";
import { resendDocumentShare, shareStatusLabel, type DocumentShareRecord } from "@/lib/document-shares";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function DocumentSharesPanel({ shares, loading, onRefresh }: { shares: DocumentShareRecord[]; loading?: boolean; onRefresh?: () => void }) {
  const [resendingId, setResendingId] = React.useState<number | null>(null);
  const [confirmId, setConfirmId] = React.useState<number | null>(null);

  const handleResend = async (id: number) => {
    setConfirmId(null);
    setResendingId(id);
    try {
      await resendDocumentShare(id);
      toast.success("Document link sent again");
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResendingId(null);
    }
  };

  // Nothing worth a whole panel until something has been sent.
  if (!loading && shares.length === 0) return null;

  const sorted = [...shares].sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""));

  return (
    <section aria-labelledby="shares-title" className={cn(CARD, "overflow-hidden")}>
      <div className="p-5 pb-4">
        <h3 id="shares-title" className="text-[15px] font-medium">
          Files sent to the client
        </h3>
        <p className="text-[13px] text-muted-foreground">See whether they&apos;ve opened what you sent.</p>
      </div>
      {loading ? (
        <div className="flex justify-center border-t border-border/50 py-8 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        </div>
      ) : (
        <ul className="divide-y divide-border/50 border-t border-border/50">
          {sorted.map((share) => (
            <li key={share.id} className="px-5 py-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{share.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        share.status === "viewed"
                          ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
                      )}
                    >
                      {share.status === "viewed" ? "Opened" : shareStatusLabel(share.status) === "Sent" ? "Not opened yet" : shareStatusLabel(share.status)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {share.recipient_email} · sent {formatDate(share.sent_at)}
                    {share.status === "viewed" && share.viewed_at ? (
                      <span className="ml-1 inline-flex items-center gap-1 text-[#2D5A27] dark:text-emerald-300">
                        · <CheckCircle2 aria-hidden="true" className="size-3" /> opened {formatDate(share.viewed_at)}
                      </span>
                    ) : null}
                  </p>
                </div>
                {confirmId !== share.id ? (
                  <button
                    type="button"
                    disabled={resendingId === share.id}
                    onClick={() => setConfirmId(share.id)}
                    className="flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 sm:self-auto dark:hover:bg-muted"
                  >
                    {resendingId === share.id ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <RefreshCcw aria-hidden="true" className="size-3.5" />}
                    Send again
                  </button>
                ) : null}
              </div>
              {confirmId === share.id ? (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#F7F6F1] p-3 sm:flex-row sm:items-center dark:bg-muted/50">
                  <p className="flex-1 text-[13px]">
                    Email this file again to <span className="font-medium">{share.recipient_email}</span>?
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmId(null)} className="h-9 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border hover:bg-white dark:hover:bg-card">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void handleResend(share.id)} className="h-9 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                      Send again
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
