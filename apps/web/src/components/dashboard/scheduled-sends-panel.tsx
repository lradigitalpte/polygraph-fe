"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowUpRight, Ban, Link2, Loader2, LockKeyhole, Pause, Pencil, Play, Send } from "lucide-react";
import { toast } from "sonner";

import { Segmented } from "@/components/dashboard/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatClinicDateTime } from "@/lib/clinic-time";
import {
  cancelScheduledSend,
  fetchScheduledSends,
  holdScheduledSend,
  REPORT_SHARE_EXPIRY_OPTIONS,
  resumeScheduledSend,
  sendScheduledNow,
  updateScheduledSend,
  type ScheduledReportSend,
} from "@/lib/reports";
import { formatSubjectName } from "@/lib/subjects";
import { cn } from "@/lib/utils";

type View = "active" | "history";
type Tone = "amber" | "sage" | "red" | "grey" | "lavender";

const TONE: Record<Tone, { chip: string; dot: string }> = {
  amber: { chip: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300", dot: "bg-[#E2B35A]" },
  sage: { chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
  red: { chip: "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300", dot: "bg-[#C2453A]" },
  grey: { chip: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground", dot: "bg-[#8B887E]" },
  lavender: { chip: "bg-[#EFEBFE] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200", dot: "bg-[#7C6BD6]" },
};

/** Plain-language status for a row, including why a due send is waiting. */
function describe(send: ScheduledReportSend): { label: string; tone: Tone; detail?: string } {
  switch (send.status) {
    case "sent":
      return { label: "Sent", tone: "sage", detail: send.sent_at ? formatClinicDateTime(send.sent_at) : undefined };
    case "cancelled":
      return { label: "Cancelled", tone: "grey" };
    case "sending":
      return { label: "Sending…", tone: "lavender" };
    case "failed":
      return { label: "Failed", tone: "red", detail: send.last_error };
    case "held":
      return { label: "On hold", tone: "grey", detail: send.hold_reason || undefined };
  }
  switch (send.blocked_reason) {
    case "report_unlocked":
      return { label: "Paused: being edited", tone: "lavender", detail: "Resumes when the examiner signs again" };
    case "needs_recipient":
      return { label: "Needs recipient", tone: "red", detail: "Add an email or it won't send" };
    case "awaiting_payment":
      return { label: "Waiting for payment", tone: "amber", detail: "Sends once the exam is marked paid" };
  }
  return new Date(send.send_at).getTime() <= Date.now()
    ? { label: "Sending shortly", tone: "lavender", detail: "Goes out on the next hourly run" }
    : { label: "Scheduled", tone: "amber" };
}

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Due now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `in ${hours}h`;
  return `in ${Math.max(1, Math.round(ms / 60_000))}m`;
}

const nameOf = (send: ScheduledReportSend) =>
  send.subject ? formatSubjectName(send.subject) || `Examinee #${send.subject_id}` : `Examinee #${send.subject_id}`;

const editable = (send: ScheduledReportSend) => send.status === "scheduled" || send.status === "held" || send.status === "failed";

type Confirm = { kind: "send" | "cancel"; send: ScheduledReportSend } | null;

export function ScheduledSendsPanel({ search, onCountChange, onDelivered }: { search: string; onCountChange?: (n: number) => void; onDelivered?: () => void }) {
  const router = useRouter();
  const [view, setView] = React.useState<View>("active");
  const [sends, setSends] = React.useState<ScheduledReportSend[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [editing, setEditing] = React.useState<ScheduledReportSend | null>(null);
  const [, setTick] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScheduledSends(view);
      setSends(data);
      if (view === "active") onCountChange?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scheduled sends");
    } finally {
      setLoading(false);
    }
  }, [view, onCountChange]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Keep countdowns current without refetching.
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const replace = (updated: ScheduledReportSend) => {
    const stillActive = view === "active" && editable(updated);
    setSends((prev) => {
      const next = view === "active" && !stillActive ? prev.filter((s) => s.id !== updated.id) : prev.map((s) => (s.id === updated.id ? updated : s));
      if (view === "active") onCountChange?.(next.length);
      return next;
    });
  };

  const run = async (send: ScheduledReportSend, action: () => Promise<ScheduledReportSend>, success: string) => {
    setBusyId(send.id);
    try {
      const updated = await action();
      replace(updated);
      if (updated.status === "failed") toast.error(updated.last_error || "Send failed");
      else toast.success(success);
      if (updated.status === "sent") onDelivered?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const needle = search.trim().toLowerCase();
  const rows = needle
    ? sends.filter((s) => [nameOf(s), s.client_name ?? "", s.recipient_email].some((v) => v.toLowerCase().includes(needle)))
    : sends;

  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Segmented
          label="Scheduled view"
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: "Waiting to send" },
            { value: "history", label: "Sent & cancelled" },
          ]}
        />
        <p className="text-[13px] text-muted-foreground">
          Signed reports email the client automatically 48h after signing, password-protected unless the client is set otherwise.
        </p>
      </div>

      {error ? (
        <div className="flex items-center gap-2 bg-[#F6E3E1] px-6 py-3 text-sm text-[#8A2C22] dark:bg-red-950 dark:text-red-300">
          <AlertCircle aria-hidden="true" className="size-4" />
          {error}
          <button type="button" onClick={() => void load()} className="ml-auto font-medium hover:underline">
            Try again
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
              {["Examinee", "Recipient", view === "active" ? "Sends" : "Scheduled for", "Status"].map((c) => (
                <th key={c} className="px-6 pt-5 pb-3 font-medium">
                  {c}
                </th>
              ))}
              <th className="px-6 pt-5 pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading && sends.length === 0 ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-3.5">
                    <div className="h-9 animate-pulse rounded-xl bg-muted" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center">
                  <p className="text-[15px] font-medium">{needle ? "Nothing matches this search" : view === "active" ? "Nothing waiting to send" : "No history yet"}</p>
                  {!needle && view === "active" ? (
                    <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">When an examiner signs a report it appears here with a 48-hour countdown.</p>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((send) => {
                const status = describe(send);
                const tone = TONE[status.tone];
                const busy = busyId === send.id;
                const canEdit = editable(send);
                const name = nameOf(send);
                return (
                  <tr key={send.id} className="align-top transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                    <td className="max-w-[260px] px-6 py-4">
                      <span className="flex items-center gap-2">
                        {send.verdict ? <span className="shrink-0 rounded-md bg-[#ECE9E0] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#55534C] dark:bg-muted dark:text-muted-foreground">{send.verdict}</span> : null}
                        <span className="truncate font-medium">{name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{send.client_name || "—"}</span>
                    </td>
                    <td className="max-w-[260px] px-6 py-4">
                      <span className={cn("block truncate", !send.recipient_email && "text-[#8A2C22] dark:text-red-300")}>{send.recipient_email || "No email on file"}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                        {send.protection_mode === "secure_link" ? (
                          <>
                            <Link2 aria-hidden="true" className="size-3" /> No password
                          </>
                        ) : (
                          <>
                            <LockKeyhole aria-hidden="true" className="size-3" /> Password
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {view === "active" ? <span className="block font-medium tabular-nums">{countdown(send.send_at)}</span> : null}
                      <span className={cn("block", view === "active" && "text-[13px] text-muted-foreground")}>{formatClinicDateTime(send.send_at)}</span>
                    </td>
                    <td className="max-w-[260px] px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap", tone.chip)}>
                        <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
                        {status.label}
                      </span>
                      {status.detail ? <span className="mt-1 block text-[13px] text-muted-foreground [overflow-wrap:anywhere]">{status.detail}</span> : null}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <RowButton primary label="Send now" icon={busy ? Loader2 : Send} spin={busy} disabled={busy || send.blocked_reason === "report_unlocked"} onClick={() => setConfirm({ kind: "send", send })} />
                        ) : null}
                        {canEdit ? <RowButton iconOnly label="Edit recipient & protection" icon={Pencil} disabled={busy} onClick={() => setEditing(send)} /> : null}
                        {send.status === "scheduled" ? (
                          <RowButton iconOnly label="Put on hold" icon={Pause} disabled={busy} onClick={() => void run(send, () => holdScheduledSend(send.id), "Put on hold")} />
                        ) : null}
                        {send.status === "held" || send.status === "failed" ? (
                          <RowButton
                            iconOnly
                            label={send.status === "failed" ? "Retry on next run" : "Resume"}
                            icon={Play}
                            disabled={busy}
                            onClick={() => void run(send, () => resumeScheduledSend(send.id), send.status === "failed" ? "Queued to retry" : "Resumed")}
                          />
                        ) : null}
                        {canEdit ? <RowButton iconOnly label="Cancel automatic send" icon={Ban} disabled={busy} onClick={() => setConfirm({ kind: "cancel", send })} /> : null}
                        <RowButton
                          iconOnly
                          label="Open report"
                          icon={ArrowUpRight}
                          onClick={() => router.push(`/dashboard/reports/${send.exam_id}?subject=${encodeURIComponent(name)}`)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        confirm={confirm}
        busy={confirm ? busyId === confirm.send.id : false}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const { kind, send } = confirm;
          if (kind === "send") await run(send, () => sendScheduledNow(send.id), `Report sent to ${send.recipient_email}`);
          else await run(send, () => cancelScheduledSend(send.id), "Automatic send cancelled");
          setConfirm(null);
        }}
      />
      <EditDialog
        send={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          replace(updated);
          setEditing(null);
          toast.success("Delivery updated");
        }}
      />
    </div>
  );
}

function ConfirmDialog({ confirm, busy, onClose, onConfirm }: { confirm: Confirm; busy: boolean; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const send = confirm?.send;
  const isSend = confirm?.kind === "send";
  return (
    <Dialog open={confirm !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{isSend ? "Send this report now?" : "Cancel the automatic send?"}</DialogTitle>
          <DialogDescription>
            {send && isSend ? (
              <>
                The report for <strong>{nameOf(send)}</strong> will be emailed to <strong>{send.recipient_email}</strong> as a{" "}
                {send.protection_mode === "secure_link" ? "PDF with no password" : "password-protected PDF"}, without waiting for the 48 hours
                {send.blocked_reason === "awaiting_payment" ? " or for payment" : ""}.
              </>
            ) : send ? (
              <>
                The report for <strong>{nameOf(send)}</strong> won't be emailed automatically. You can still send it by hand from the Sessions view.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={busy}>
            Go back
          </Button>
          <Button className="gap-2 rounded-xl font-bold" variant={isSend ? "default" : "destructive"} onClick={() => void onConfirm()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSend ? "Send now" : "Cancel send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ send, onClose, onSaved }: { send: ScheduledReportSend | null; onClose: () => void; onSaved: (s: ScheduledReportSend) => void }) {
  const [email, setEmail] = React.useState("");
  const [mode, setMode] = React.useState<"password" | "secure_link">("password");
  const [expiry, setExpiry] = React.useState(7);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!send) return;
    setEmail(send.recipient_email);
    setMode(send.protection_mode === "secure_link" ? "secure_link" : "password");
    setExpiry(send.expiry_days || 7);
  }, [send]);

  const save = async () => {
    if (!send) return;
    setSaving(true);
    try {
      onSaved(await updateScheduledSend(send.id, { recipient_email: email.trim(), protection_mode: mode, expiry_days: expiry }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={send !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Edit delivery</DialogTitle>
          <DialogDescription>Changes apply to this report only. The send time stays the same.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="sched-email">Recipient email</Label>
            <Input id="sched-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" />
          </div>
          <div className="space-y-2">
            <Label>PDF protection</Label>
            <div className="grid gap-2">
              {(
                [
                  ["password", LockKeyhole, "Password-protected PDF", "Default. The passcode is revealed through the secure link."],
                  ["secure_link", Link2, "No PDF password", "Only if the client asked for it. The attachment can be opened and forwarded freely."],
                ] as const
              ).map(([value, Icon, title, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn("rounded-xl border p-3 text-left transition-colors", mode === value ? "border-primary bg-primary/5" : "border-border")}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Icon className="size-4" />
                    {title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched-expiry">Secure link expires after</Label>
            <Select value={String(expiry)} onValueChange={(v) => setExpiry(Number(v))}>
              <SelectTrigger id="sched-expiry" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {REPORT_SHARE_EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="gap-2 rounded-xl font-bold" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

function RowButton({
  label,
  icon: Icon,
  onClick,
  primary,
  iconOnly,
  disabled,
  spin,
}: {
  label: string;
  icon: IconType;
  onClick: () => void;
  primary?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-50",
        iconOnly ? "w-9 text-muted-foreground hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted" : "px-3.5",
        !iconOnly && primary && "bg-[#30302E] text-[#FAF9F5] hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground",
      )}
    >
      <Icon aria-hidden="true" className={cn(iconOnly ? "size-4" : "size-3.5", spin && "animate-spin")} />
      {iconOnly ? null : label}
    </button>
  );
}
