"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formRequestStatusLabel, formatFormDate, parseTemplateSchema, resendFormRequest, type FormField, type FormRequestRecord } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { ClipboardList, Eye, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

// Build an ordered [label, value] list for a completed request's submission,
// using the template schema for labels/order and falling back to raw keys.
function buildAnswerRows(req: FormRequestRecord): { label: string; value: string }[] {
  let data: Record<string, unknown> = {};
  try {
    data = req.submitted_data ? (JSON.parse(req.submitted_data) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  const fmt = (v: unknown): string => {
    if (v === true) return "Yes";
    if (v === false) return "No";
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  };
  const fields: FormField[] = req.template ? parseTemplateSchema(req.template).fields : [];
  if (fields.length > 0) return fields.map((f) => ({ label: f.label, value: fmt(data[f.key]) }));
  return Object.entries(data).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: fmt(v) }));
}

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  sent: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
  opened: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
};

export function FormRequestsPanel({ requests, loading, onRefresh }: { requests: FormRequestRecord[]; loading?: boolean; onRefresh?: () => void }) {
  const [resendingId, setResendingId] = React.useState<number | null>(null);
  const [confirmId, setConfirmId] = React.useState<number | null>(null);
  const [viewing, setViewing] = React.useState<FormRequestRecord | null>(null);

  const sorted = [...requests].sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""));
  const pending = requests.filter((r) => r.status === "sent" || r.status === "opened");

  const handleResend = async (id: number) => {
    setConfirmId(null);
    setResendingId(id);
    try {
      await resendFormRequest(id);
      toast.success("Reminder email sent");
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the reminder");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <section aria-labelledby="form-requests-title" className={cn(CARD, "overflow-hidden")}>
      <div className="flex items-center justify-between gap-3 p-5 pb-4">
        <div>
          <h3 id="form-requests-title" className="text-[15px] font-medium">
            Forms sent
          </h3>
          <p className="text-[13px] text-muted-foreground">{pending.length > 0 ? `${pending.length} waiting for the client.` : "Track every form link you've emailed."}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center border-t border-border/50 py-10 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border/50 px-6 py-10 text-center">
          <ClipboardList aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No forms sent yet. Use the button above to email consent, privacy or intake forms.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50 border-t border-border/50">
          {sorted.map((req) => {
            const waiting = req.status === "sent" || req.status === "opened";
            return (
              <li key={req.id} className="px-5 py-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{req.template?.name ?? `Form #${req.template_id}`}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[req.status] ?? "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground")}>
                        {req.status === "sent" ? "Waiting" : formRequestStatusLabel(req.status)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {req.recipient_email} · sent {formatFormDate(req.sent_at)}
                    </p>
                    {req.status === "completed" && req.completed_at ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#2D5A27] dark:text-emerald-300">
                        <ShieldCheck aria-hidden="true" className="size-3.5" /> Completed {formatFormDate(req.completed_at)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {waiting && confirmId !== req.id ? (
                      <button
                        type="button"
                        disabled={resendingId === req.id}
                        onClick={() => setConfirmId(req.id)}
                        className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted"
                      >
                        {resendingId === req.id ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <RefreshCcw aria-hidden="true" className="size-3.5" />}
                        Remind
                      </button>
                    ) : null}
                    {req.status === "completed" ? (
                      <button
                        type="button"
                        onClick={() => setViewing(req)}
                        className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                      >
                        <Eye aria-hidden="true" className="size-3.5" /> View answers
                      </button>
                    ) : null}
                  </div>
                </div>
                {confirmId === req.id ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#F7F6F1] p-3 sm:flex-row sm:items-center dark:bg-muted/50">
                    <p className="flex-1 text-[13px]">
                      Email a reminder to <span className="font-medium">{req.recipient_email}</span>?
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmId(null)} className="h-9 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border hover:bg-white dark:hover:bg-card">
                        Cancel
                      </button>
                      <button type="button" onClick={() => void handleResend(req.id)} className="h-9 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                        Send reminder
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-[26px]">
          <DialogHeader>
            <DialogTitle>{viewing?.template?.name ?? "Submitted form"}</DialogTitle>
            <DialogDescription>
              {viewing?.recipient_email}
              {viewing?.completed_at ? ` · completed ${formatFormDate(viewing.completed_at)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing ? (
            buildAnswerRows(viewing).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No submitted answers are available for this form.</p>
            ) : (
              <dl className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] text-sm dark:bg-muted/40">
                {buildAnswerRows(viewing).map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.3fr] gap-3 px-4 py-2.5">
                    <dt className="text-muted-foreground capitalize">{row.label}</dt>
                    <dd className="font-medium wrap-break-word">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
