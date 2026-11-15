"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSignature,
  Loader2,
  RotateCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { CredentialsRichTextContent } from "@/components/dashboard/credentials-rich-text-editor";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AGREEMENT_STATUS_LABELS,
  downloadAgreementPdf,
  fetchAgreementRequest,
  fetchAgreementTemplates,
  fetchClientAgreementRequests,
  isAgreementRequestOpen,
  resendAgreementRequest,
  sendClientAgreements,
  voidAgreementRequest,
  type AgreementRequest,
  type AgreementRequestDetail,
  type AgreementRequestStatus,
  type AgreementTemplate,
} from "@/lib/agreements";
import { isOrganizationClient } from "@/lib/client-types";
import { formatClinicDateTime } from "@/lib/clinic-time";
import type { AppointmentRecord } from "@/lib/exam-booking";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

const STATUS_STYLES: Record<AgreementRequestStatus, string> = {
  sent: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
  viewed: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  signed: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-destructive/10 text-destructive",
  expired: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground",
  voided: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground",
};

const STATUS_TEXT: Partial<Record<AgreementRequestStatus, string>> = {
  sent: "Waiting — not opened",
  viewed: "Opened — not signed",
};

const NO_BOOKING = "none";

function StatusBadge({ status }: { status: AgreementRequestStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLES[status])}>
      {STATUS_TEXT[status] ?? AGREEMENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function bookingLabel(appt: AppointmentRecord) {
  return `${formatClinicDateTime(appt.scheduled_at)} · ${appt.status}`;
}

async function downloadPdf(id: number) {
  try {
    await downloadAgreementPdf(id);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to download PDF");
  }
}

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    toast.success("Signing link copied");
  } catch {
    toast.error("Could not copy. Link: " + link);
  }
}

function pillButton(extra?: string) {
  return cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted", extra);
}

export default function ClientApprovalsPage() {
  const { client, clientId, appointments, loading: clientLoading } = useClientDetail();
  const { can } = useCurrentUser();
  const canSend = can("agreement:send");

  const [requests, setRequests] = React.useState<AgreementRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const closeDetail = React.useCallback(() => setDetailId(null), []);
  const [confirmAction, setConfirmAction] = React.useState<{ kind: "resend" | "void"; request: AgreementRequest } | null>(null);
  const [acting, setActing] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setRequests(await fetchClientAgreementRequests(clientId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load agreements");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const appointmentsById = React.useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);

  if (clientLoading && !client) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (client && isOrganizationClient(client)) {
    return (
      <section className={cn(CARD, "p-6")}>
        <h2 className="text-[17px] font-medium">Approvals</h2>
        <p className="mt-1 text-sm text-muted-foreground">Online agreements are only sent to individual clients. Corporate and law-firm accounts are handled separately.</p>
      </section>
    );
  }

  const sorted = [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const open = sorted.filter(isAgreementRequestOpen);
  const signed = sorted.filter((r) => r.status === "signed");
  const declined = sorted.filter((r) => r.status === "declined");
  const history = sorted.filter((r) => !isAgreementRequestOpen(r));
  const latestSigned = signed[0];

  // Two or more open links for the same booking (or both unbooked) are almost always
  // leftovers; the client only needs one.
  const openKeys = open.map((r) => r.appointment_id ?? 0);
  const hasDuplicates = new Set(openKeys).size < openKeys.length;

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setActing(true);
    try {
      if (confirmAction.kind === "resend") {
        await resendAgreementRequest(confirmAction.request.id);
        toast.success(`Reminder emailed to ${confirmAction.request.recipient_email}`);
      } else {
        await voidAgreementRequest(confirmAction.request.id);
        toast.success("Link withdrawn — it no longer works");
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  };

  const renderRequest = (request: AgreementRequest) => {
    const appt = request.appointment_id ? appointmentsById.get(request.appointment_id) : undefined;
    const isOpen = isAgreementRequestOpen(request);
    return (
      <li key={request.id} className="px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={request.status} />
              <span className="text-xs text-muted-foreground">{appt ? `Booking ${formatClinicDateTime(appt.scheduled_at)}` : request.appointment_id ? "Booking removed" : "Not linked to a booking"}</span>
            </div>
            <p className="text-sm font-medium">{request.items.map((i) => i.title).join(" · ")}</p>
            <p className="text-xs text-muted-foreground">
              {request.emailed_at ? (
                <>
                  Emailed to {request.recipient_email} · {formatClinicDateTime(request.emailed_at)}
                </>
              ) : (
                <>
                  Link created {formatClinicDateTime(request.created_at)} · <span className="font-medium text-foreground/80">not emailed by the system</span>
                </>
              )}
              {request.sent_by_email ? ` · by ${request.sent_by_email}` : ""}
              {isOpen ? ` · expires ${formatClinicDateTime(request.expires_at)}` : ""}
            </p>
            {request.status === "signed" && request.signed_at ? (
              <p className="flex items-center gap-1 text-xs font-medium text-[#2D5A27] dark:text-emerald-300">
                <CheckCircle2 aria-hidden="true" className="size-3.5" /> Signed by {request.signed_name} on {formatClinicDateTime(request.signed_at)}
              </p>
            ) : null}
            {request.status === "declined" ? <p className="text-xs text-destructive">Declined{request.decline_reason ? `: “${request.decline_reason}”` : ""}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" className={pillButton()} onClick={() => setDetailId(request.id)}>
              <Eye aria-hidden="true" className="size-3.5" /> View
            </button>
            {request.status === "signed" ? (
              <button type="button" className={pillButton()} onClick={() => void downloadPdf(request.id)}>
                <Download aria-hidden="true" className="size-3.5" /> PDF
              </button>
            ) : null}
            {isOpen && request.link ? (
              <button type="button" className={pillButton()} onClick={() => void copyLink(request.link!)}>
                <Copy aria-hidden="true" className="size-3.5" /> Copy link
              </button>
            ) : null}
            {isOpen && canSend ? (
              <button type="button" className={pillButton()} onClick={() => setConfirmAction({ kind: "resend", request })}>
                {request.emailed_at ? <RotateCw aria-hidden="true" className="size-3.5" /> : <Send aria-hidden="true" className="size-3.5" />}
                {request.emailed_at ? "Remind" : "Email it"}
              </button>
            ) : null}
            {canSend && isOpen ? (
              <button type="button" className={pillButton("text-destructive")} onClick={() => setConfirmAction({ kind: "void", request })}>
                <Ban aria-hidden="true" className="size-3.5" /> Withdraw
              </button>
            ) : null}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Approvals</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Payment, reschedule and cancellation agreements for {client?.name ?? "this client"}, and what they signed.</p>
        </div>
        {canSend ? (
          <button
            type="button"
            onClick={() => setSendOpen(true)}
            className="flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] sm:self-auto dark:bg-foreground dark:text-background"
          >
            <Send aria-hidden="true" className="size-4" /> Send agreements
          </button>
        ) : null}
      </div>

      {/* Where things stand */}
      {!loading && requests.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Signed", value: signed.length, hint: latestSigned?.signed_at ? `Last ${formatClinicDateTime(latestSigned.signed_at)}` : "Nothing signed yet", icon: CheckCircle2 },
            { label: "Waiting", value: open.length, hint: open.length ? `${open.filter((r) => r.status === "viewed").length} opened` : "Nothing outstanding", icon: FileSignature },
            { label: "Declined", value: declined.length, hint: declined.length ? "See reason below" : "None", icon: Ban },
            { label: "Links made", value: requests.length, hint: `${requests.filter((r) => r.emailed_at).length} emailed`, icon: Send },
          ].map((t) => (
            <div key={t.label} className={cn(CARD, "p-4")}>
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <t.icon aria-hidden="true" className="size-3.5" />
                {t.label}
              </p>
              <p className="mt-1 text-2xl font-medium tracking-[-0.02em] tabular-nums">{t.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.hint}</p>
            </div>
          ))}
        </div>
      ) : null}

      {hasDuplicates ? (
        <div className="flex gap-3 rounded-2xl bg-[#F8EEDB] px-4 py-3 dark:bg-amber-950/60">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#8A5A12] dark:text-amber-300" />
          <p className="text-[13px] text-[#5C3D0C] dark:text-amber-100">
            There&apos;s more than one open link for the same booking. The client only needs one — withdraw the extra so they don&apos;t sign twice.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className={cn(CARD, "flex items-center justify-center py-14 text-sm text-muted-foreground")}>
          <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" /> Loading agreements…
        </div>
      ) : requests.length === 0 ? (
        <section className={cn(CARD, "flex flex-col items-center gap-3 px-6 py-14 text-center")}>
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <FileSignature aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <div className="max-w-sm">
            <p className="font-medium">No agreements yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Send the client one link to read and sign your payment, reschedule and cancellation terms.</p>
          </div>
          {canSend ? (
            <button type="button" onClick={() => setSendOpen(true)} className={pillButton("h-10 px-4")}>
              <Send aria-hidden="true" className="size-4" /> Send agreements
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <section aria-labelledby="open-title" className={cn(CARD, "overflow-hidden")}>
            <div className="p-5 pb-4">
              <h3 id="open-title" className="text-[15px] font-medium">
                Waiting for signature
              </h3>
              <p className="text-[13px] text-muted-foreground">Links the client can still sign.</p>
            </div>
            {open.length === 0 ? (
              <p className="border-t border-border/50 px-6 py-8 text-center text-sm text-muted-foreground">Nothing waiting — everything has been signed, declined or withdrawn.</p>
            ) : (
              <ul className="divide-y divide-border/50 border-t border-border/50">{open.map(renderRequest)}</ul>
            )}
          </section>

          {history.length > 0 ? (
            <section aria-labelledby="history-title" className={cn(CARD, "overflow-hidden")}>
              <button
                type="button"
                aria-expanded={showHistory || open.length === 0}
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <span>
                  <span id="history-title" className="block text-[15px] font-medium">
                    Signed &amp; past
                  </span>
                  <span className="block text-[13px] text-muted-foreground">
                    {signed.length} signed{declined.length ? ` · ${declined.length} declined` : ""}
                    {history.length - signed.length - declined.length > 0 ? ` · ${history.length - signed.length - declined.length} expired or withdrawn` : ""}
                  </span>
                </span>
                <span className="text-[13px] font-medium text-muted-foreground">{showHistory || open.length === 0 ? "Hide" : "Show"}</span>
              </button>
              {showHistory || open.length === 0 ? <ul className="divide-y divide-border/50 border-t border-border/50">{history.map(renderRequest)}</ul> : null}
            </section>
          ) : null}
        </>
      )}

      {client ? (
        <SendAgreementsDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          clientId={clientId}
          clientName={client.name}
          clientEmail={client.email ?? ""}
          appointments={appointments}
          onSent={load}
        />
      ) : null}

      <AgreementDetailDialog requestId={detailId} onClose={closeDetail} appointmentsById={appointmentsById} />

      <Dialog open={confirmAction != null} onOpenChange={(o) => !o && !acting && setConfirmAction(null)}>
        <DialogContent className="rounded-[26px]">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.kind === "resend" ? (confirmAction.request.emailed_at ? "Email a reminder?" : "Email this link to the client?") : "Withdraw this link?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.kind === "resend"
                ? `${confirmAction.request.recipient_email} will get an email with the signing link. The link will work for another 14 days.`
                : "The signing link stops working immediately. The client will need a new link to sign."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmAction(null)} disabled={acting}>
              Cancel
            </Button>
            <Button variant={confirmAction?.kind === "void" ? "destructive" : "default"} className="rounded-full" onClick={() => void runConfirmedAction()} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmAction?.kind === "resend" ? "Send email" : "Withdraw link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SendAgreementsDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientEmail,
  appointments,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName: string;
  clientEmail: string;
  appointments: AppointmentRecord[];
  onSent: () => Promise<void>;
}) {
  const [templates, setTemplates] = React.useState<AgreementTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<number, boolean>>({});
  const [bookingId, setBookingId] = React.useState<string>(NO_BOOKING);
  const [recipientName, setRecipientName] = React.useState(clientName);
  const [recipientEmail, setRecipientEmail] = React.useState(clientEmail);
  const [delivery, setDelivery] = React.useState<"email" | "link">("email");
  const [step, setStep] = React.useState<"form" | "confirm" | "done">("form");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ link: string; emailError?: string; emailed: boolean } | null>(null);

  const bookable = React.useMemo(
    () => appointments.filter((a) => a.status !== "cancelled" && a.status !== "completed").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [appointments],
  );

  // Latest client/bookings, read when the dialog opens. Keeping them out of the effect's
  // dependencies means a background refresh of the bookings doesn't wipe the staff
  // member's ticks and booking choice while the dialog is open.
  const defaultsRef = React.useRef({ clientName, clientEmail, bookable });
  defaultsRef.current = { clientName, clientEmail, bookable };

  // Reset each time the dialog opens: all active agreements ticked, next upcoming booking selected.
  React.useEffect(() => {
    if (!open) return;
    const { clientName: name, clientEmail: email, bookable: bookings } = defaultsRef.current;
    let cancelled = false;
    setStep("form");
    setResult(null);
    setDelivery("email");
    setRecipientName(name);
    setRecipientEmail(email);
    const now = new Date().toISOString();
    const next = bookings.find((a) => a.scheduled_at >= now) ?? bookings[bookings.length - 1];
    setBookingId(next ? String(next.id) : NO_BOOKING);
    setTemplatesLoading(true);
    fetchAgreementTemplates()
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        setSelected(Object.fromEntries(rows.map((t) => [t.id, true])));
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load agreements");
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const chosen = templates.filter((t) => selected[t.id]);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim());
  const booking = bookable.find((a) => String(a.id) === bookingId);
  const willEmail = delivery === "email";

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendClientAgreements(clientId, {
        appointment_id: booking?.id,
        template_ids: chosen.map((t) => t.id),
        recipient_email: recipientEmail.trim(),
        recipient_name: recipientName.trim(),
        skip_email: !willEmail,
      });
      setResult({ link: res.link, emailError: res.email_error, emailed: willEmail && !res.email_error });
      setStep("done");
      if (willEmail && !res.email_error) toast.success(`Agreements emailed to ${recipientEmail.trim()}`);
      await onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the agreements link");
      setStep("form");
    } finally {
      setSending(false);
    }
  };

  const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
  const optionCard = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-colors",
      active ? "bg-white ring-2 ring-primary dark:bg-card" : "bg-[#F7F6F1] ring-1 ring-border/50 hover:bg-[#F3F1EA] dark:bg-muted/40 dark:hover:bg-muted",
    );
  const radioDot = (active: boolean) =>
    cn("flex size-5 shrink-0 items-center justify-center rounded-full", active ? "bg-primary text-white" : "bg-white ring-1 ring-border dark:bg-card");

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-[26px]">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Send agreements</DialogTitle>
              <DialogDescription>{clientName.split(" ")[0]} gets one secure link to read, tick and sign every agreement you pick.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              <div className="grid gap-2">
                <span className="px-1 text-[13px] font-medium">Agreements</span>
                {templatesLoading ? (
                  <p className="px-1 text-sm text-muted-foreground">Loading…</p>
                ) : templates.length === 0 ? (
                  <p className="rounded-2xl bg-[#F7F6F1] px-4 py-3 text-sm text-muted-foreground dark:bg-muted/40">No agreements are offered yet. Add them in Settings → Agreements.</p>
                ) : (
                  <div className="grid gap-2">
                    {templates.map((t) => {
                      const on = Boolean(selected[t.id]);
                      return (
                        <button key={t.id} type="button" role="checkbox" aria-checked={on} onClick={() => setSelected((prev) => ({ ...prev, [t.id]: !on }))} className={optionCard(on)}>
                          <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md", on ? "bg-primary text-white" : "bg-white ring-1 ring-border dark:bg-card")}>
                            {on ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                          </span>
                          <span className="flex-1 text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-muted-foreground">v{t.version}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <span className="px-1 text-[13px] font-medium">For which booking?</span>
                <div className="grid gap-2">
                  {bookable.map((a) => {
                    const on = bookingId === String(a.id);
                    return (
                      <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setBookingId(String(a.id))} className={optionCard(on)}>
                        <span className={radioDot(on)}>{on ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{formatClinicDateTime(a.scheduled_at)}</span>
                          <span className="block text-xs text-muted-foreground capitalize">{a.status.replace(/[_-]+/g, " ")}</span>
                        </span>
                      </button>
                    );
                  })}
                  <button type="button" role="radio" aria-checked={bookingId === NO_BOOKING} onClick={() => setBookingId(NO_BOOKING)} className={optionCard(bookingId === NO_BOOKING)}>
                    <span className={radioDot(bookingId === NO_BOOKING)}>{bookingId === NO_BOOKING ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}</span>
                    <span className="flex-1 text-sm font-medium">Not linked to a booking</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="recipient-name" className="px-1 text-[13px] font-medium">Name</Label>
                  <Input id="recipient-name" className={FIELD} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="recipient-email" className="px-1 text-[13px] font-medium">Email</Label>
                  <Input id="recipient-email" type="email" className={FIELD} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-2">
                <span className="px-1 text-[13px] font-medium">How should it reach them?</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      { value: "email", label: "Email it now", hint: "We send the signing link to their inbox.", icon: Send },
                      { value: "link", label: "Just create the link", hint: "Copy it and share on WhatsApp or anywhere.", icon: Copy },
                    ] as const
                  ).map((o) => (
                    <button key={o.value} type="button" role="radio" aria-checked={delivery === o.value} onClick={() => setDelivery(o.value)} className={cn(optionCard(delivery === o.value), "items-start")}>
                      <o.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{o.label}</span>
                        <span className="block text-xs text-muted-foreground">{o.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {willEmail ? (
                <Button className="rounded-full" onClick={() => setStep("confirm")} disabled={chosen.length === 0 || !emailValid}>
                  Review &amp; send
                </Button>
              ) : (
                <Button className="gap-2 rounded-full" onClick={() => void handleSend()} disabled={chosen.length === 0 || !emailValid || sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Create link
                </Button>
              )}
            </DialogFooter>
          </>
        ) : step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Send this email now?</DialogTitle>
              <DialogDescription>Check the details before the email goes out.</DialogDescription>
            </DialogHeader>
            <dl className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] text-sm dark:bg-muted/40">
              {[
                ["To", `${recipientName.trim() || clientName} <${recipientEmail.trim()}>`],
                ["Booking", booking ? formatClinicDateTime(booking.scheduled_at) : "Not linked to a booking"],
                [`Agreements (${chosen.length})`, chosen.map((t) => t.title).join(", ")],
                ["Link works for", "14 days"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium break-words">{v}</dd>
                </div>
              ))}
            </dl>
            <DialogFooter>
              <Button variant="outline" className="rounded-full" onClick={() => setStep("form")} disabled={sending}>
                Back
              </Button>
              <Button onClick={() => void handleSend()} disabled={sending} className="gap-2 rounded-full">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send email
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <span
                className={cn(
                  "flex size-14 items-center justify-center rounded-full",
                  result?.emailError ? "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" : "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
                )}
              >
                {result?.emailError ? <AlertTriangle aria-hidden="true" className="size-6" /> : <CheckCircle2 aria-hidden="true" className="size-6" />}
              </span>
              <DialogHeader className="items-center">
                <DialogTitle>{result?.emailError ? "Link created, but the email failed" : result?.emailed ? "Agreements emailed" : "Link ready to share"}</DialogTitle>
                <DialogDescription className="text-center">
                  {result?.emailError ??
                    (result?.emailed
                      ? `${recipientEmail.trim()} will get the signing link. You'll see the result here once they sign.`
                      : "Nothing was emailed. Copy the link below and send it to the client yourself.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            {result ? (
              <div className="flex items-center gap-2 rounded-full bg-[#F3F1EA] py-1.5 pr-1.5 pl-4 dark:bg-muted">
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={result.link}>
                  {result.link.replace(/^https?:\/\//, "")}
                </span>
                <button type="button" onClick={() => void copyLink(result.link)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                  <Copy aria-hidden="true" className="size-3.5" /> Copy
                </button>
              </div>
            ) : null}
            <DialogFooter>
              <Button className="rounded-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgreementDetailDialog({
  requestId,
  onClose,
  appointmentsById,
}: {
  requestId: number | null;
  onClose: () => void;
  appointmentsById: Map<number, AppointmentRecord>;
}) {
  const [detail, setDetail] = React.useState<AgreementRequestDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (requestId == null) {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetchAgreementRequest(requestId)
      .then(setDetail)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load agreement");
        onClose();
      })
      .finally(() => setLoading(false));
  }, [requestId, onClose]);

  const appt = detail?.appointment_id ? appointmentsById.get(detail.appointment_id) : undefined;

  const timeline: { label: string; at?: string; tone?: "good" | "bad" }[] = detail
    ? [
        { label: "Link created", at: detail.created_at },
        { label: `Emailed to ${detail.recipient_email}`, at: detail.emailed_at },
        { label: "Opened by the client", at: detail.viewed_at },
        { label: `Signed by ${detail.signed_name ?? ""}`, at: detail.signed_at, tone: "good" as const },
        { label: "Declined by the client", at: detail.declined_at, tone: "bad" as const },
        { label: `Withdrawn${detail.voided_by ? ` by ${detail.voided_by}` : ""}`, at: detail.voided_at, tone: "bad" as const },
      ].filter((e) => e.at)
    : [];

  return (
    <Dialog open={requestId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[26px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Agreement record {detail ? <StatusBadge status={detail.status} /> : null}
          </DialogTitle>
          <DialogDescription>{appt ? `Booking ${bookingLabel(appt)}` : "Not linked to a booking"}</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex justify-center py-10">
            <Loader2 aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* History */}
            <ol className="space-y-0 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
              {timeline.map((e, i) => (
                <li key={e.label} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < timeline.length - 1 ? <span aria-hidden="true" className="absolute top-4 left-[5px] h-full w-px bg-border" /> : null}
                  <span
                    aria-hidden="true"
                    className={cn("relative mt-1 size-[11px] shrink-0 rounded-full ring-2 ring-[#F7F6F1] dark:ring-muted", e.tone === "good" ? "bg-[#5FA86C]" : e.tone === "bad" ? "bg-destructive" : "bg-primary")}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{e.label}</span>
                    <span className="block text-xs text-muted-foreground">{formatClinicDateTime(e.at!)}</span>
                  </span>
                </li>
              ))}
              {!detail.emailed_at && isAgreementRequestOpen(detail) ? <li className="pt-2 text-xs text-muted-foreground">Not emailed by the system — the link was created to share by hand.</li> : null}
            </ol>

            {detail.decline_reason ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Reason given: “{detail.decline_reason}”</p> : null}

            {/* Terms */}
            <div className="space-y-2">
              <p className="px-1 text-[13px] font-medium">Terms in this link</p>
              {detail.items.map((item, index) => (
                <details key={item.id} className="group overflow-hidden rounded-2xl ring-1 ring-border/60">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] text-xs font-semibold dark:bg-muted">{index + 1}</span>
                    <span className="min-w-0 flex-1 font-medium">
                      {item.title} <span className="text-xs font-normal text-muted-foreground">v{item.template_version}</span>
                    </span>
                    {item.accepted_at ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-[#2D5A27] dark:text-emerald-300">
                        <CheckCircle2 aria-hidden="true" className="size-3.5" /> Agreed
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
                    <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
                  </summary>
                  <div className="max-h-72 overflow-y-auto border-t border-border/50 bg-[#F7F6F1] px-4 py-3 dark:bg-muted/40">
                    <CredentialsRichTextContent html={item.body_html ?? ""} className="text-sm text-foreground" />
                  </div>
                </details>
              ))}
            </div>

            {/* Signature */}
            {detail.status === "signed" ? (
              <div className="space-y-3 rounded-2xl ring-1 ring-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Signature</p>
                  <button
                    type="button"
                    onClick={() => void downloadPdf(detail.id)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
                  >
                    <Download aria-hidden="true" className="size-3.5" /> Signed PDF
                  </button>
                </div>
                {detail.signature_data_url ? (
                  <div className="rounded-xl bg-white p-3 ring-1 ring-border/50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- inline data: URL */}
                    <img src={detail.signature_data_url} alt={`Signature of ${detail.signed_name}`} className="max-h-28" />
                  </div>
                ) : null}
                <dl className="divide-y divide-border/50 overflow-hidden rounded-xl bg-[#F7F6F1] text-xs dark:bg-muted/40">
                  {[
                    ["Typed name", detail.signed_name || "—"],
                    ["IP address", detail.signer_ip || "—"],
                    ["Device", detail.signer_user_agent || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium break-all">{v}</dd>
                    </div>
                  ))}
                </dl>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Tamper-proof fingerprints</summary>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-muted-foreground">Terms (SHA-256)</dt>
                      <dd className="font-mono break-all">{detail.content_hash}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Signature (SHA-256)</dt>
                      <dd className="font-mono break-all">{detail.signature_hash}</dd>
                    </div>
                  </dl>
                </details>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
