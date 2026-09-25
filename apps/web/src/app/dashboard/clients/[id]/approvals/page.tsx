"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const STATUS_STYLES: Record<AgreementRequestStatus, string> = {
  sent: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  viewed: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  signed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  declined: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground",
  voided: "bg-muted text-muted-foreground",
};

const NO_BOOKING = "none";

function StatusBadge({ status }: { status: AgreementRequestStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
      {AGREEMENT_STATUS_LABELS[status] ?? status}
    </Badge>
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

export default function ClientApprovalsPage() {
  const { client, clientId, appointments, loading: clientLoading } = useClientDetail();
  const { can } = useCurrentUser();
  const canSend = can("agreement:send");

  const [requests, setRequests] = React.useState<AgreementRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const closeDetail = React.useCallback(() => setDetailId(null), []);
  const [confirmAction, setConfirmAction] = React.useState<{ kind: "resend" | "void"; request: AgreementRequest } | null>(
    null,
  );
  const [acting, setActing] = React.useState(false);

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

  const appointmentsById = React.useMemo(
    () => new Map(appointments.map((a) => [a.id, a])),
    [appointments],
  );

  if (clientLoading && !client) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (client && isOrganizationClient(client)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
          <CardDescription>
            Online agreements are only sent to individual clients. Corporate and law-firm accounts are handled
            separately.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const openCount = requests.filter(isAgreementRequestOpen).length;

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setActing(true);
    try {
      if (confirmAction.kind === "resend") {
        await resendAgreementRequest(confirmAction.request.id);
        toast.success(`Reminder sent to ${confirmAction.request.recipient_email}`);
      } else {
        await voidAgreementRequest(confirmAction.request.id);
        toast.success("Agreements voided — the link no longer works");
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approvals</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Payment, reschedule and cancellation agreements sent to {client?.name ?? "this client"}, and their
            signed results.
          </p>
        </div>
        {canSend ? (
          <Button className="rounded-xl gap-2" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Send agreements
          </Button>
        ) : null}
      </div>

      {openCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <span className="font-medium">
              {openCount} {openCount === 1 ? "agreement link is" : "agreement links are"} awaiting signature.
            </span>{" "}
            The client has not signed yet.
          </p>
        </div>
      ) : null}

      <Card className="border-border/50">
        <CardContent className="space-y-3 pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading agreements...</p>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileSignature className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No agreements have been sent to this client yet.</p>
              {canSend ? (
                <Button variant="outline" size="sm" onClick={() => setSendOpen(true)}>
                  Send agreements
                </Button>
              ) : null}
            </div>
          ) : (
            requests.map((request) => {
              const appt = request.appointment_id ? appointmentsById.get(request.appointment_id) : undefined;
              const open = isAgreementRequestOpen(request);
              return (
                <div
                  key={request.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/50 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={request.status} />
                      <p className="font-semibold">{request.items.map((i) => i.title).join(" · ")}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {appt ? `Booking ${bookingLabel(appt)} · ` : request.appointment_id ? "Booking removed · " : ""}
                      Sent {formatClinicDateTime(request.sent_at)} to {request.recipient_email}
                      {request.sent_by_email ? ` by ${request.sent_by_email}` : ""}
                    </p>
                    {request.status === "signed" && request.signed_at ? (
                      <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Signed by {request.signed_name} on{" "}
                        {formatClinicDateTime(request.signed_at)}
                      </p>
                    ) : null}
                    {request.status === "declined" ? (
                      <p className="text-xs text-destructive">
                        Declined{request.decline_reason ? `: “${request.decline_reason}”` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setDetailId(request.id)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                    {request.status === "signed" ? (
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => void downloadPdf(request.id)}>
                        <Download className="h-4 w-4 mr-1" /> PDF
                      </Button>
                    ) : null}
                    {open && request.link ? (
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => void copyLink(request.link!)}>
                        <Copy className="h-4 w-4 mr-1" /> Copy link
                      </Button>
                    ) : null}
                    {open && canSend ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setConfirmAction({ kind: "resend", request })}
                      >
                        <RotateCw className="h-4 w-4 mr-1" /> Resend
                      </Button>
                    ) : null}
                    {canSend && request.status !== "signed" && request.status !== "voided" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-destructive"
                        onClick={() => setConfirmAction({ kind: "void", request })}
                      >
                        <Ban className="h-4 w-4 mr-1" /> Void
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

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

      <AgreementDetailDialog
        requestId={detailId}
        onClose={closeDetail}
        appointmentsById={appointmentsById}
      />

      <Dialog open={confirmAction != null} onOpenChange={(open) => !open && !acting && setConfirmAction(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.kind === "resend" ? "Send a reminder email?" : "Void these agreements?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.kind === "resend"
                ? `A reminder with the same signing link will be emailed to ${confirmAction.request.recipient_email}.`
                : "The signing link will stop working immediately. The client will need a new link to sign."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={acting}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.kind === "void" ? "destructive" : "default"}
              onClick={() => void runConfirmedAction()}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmAction?.kind === "resend" ? "Send reminder" : "Void"}
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
  const [step, setStep] = React.useState<"form" | "confirm" | "done">("form");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ link: string; emailError?: string } | null>(null);

  const bookable = React.useMemo(
    () =>
      appointments
        .filter((a) => a.status !== "cancelled" && a.status !== "completed")
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [appointments],
  );

  // Reset each time the dialog opens: all active agreements ticked, next upcoming booking selected.
  React.useEffect(() => {
    if (!open) return;
    setStep("form");
    setResult(null);
    setRecipientName(clientName);
    setRecipientEmail(clientEmail);
    const now = new Date().toISOString();
    const next = bookable.find((a) => a.scheduled_at >= now) ?? bookable[bookable.length - 1];
    setBookingId(next ? String(next.id) : NO_BOOKING);
    setTemplatesLoading(true);
    fetchAgreementTemplates()
      .then((rows) => {
        setTemplates(rows);
        setSelected(Object.fromEntries(rows.map((t) => [t.id, true])));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load agreements"))
      .finally(() => setTemplatesLoading(false));
  }, [open, clientName, clientEmail, bookable]);

  const chosen = templates.filter((t) => selected[t.id]);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim());
  const booking = bookable.find((a) => String(a.id) === bookingId);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendClientAgreements(clientId, {
        appointment_id: booking?.id,
        template_ids: chosen.map((t) => t.id),
        recipient_email: recipientEmail.trim(),
        recipient_name: recipientName.trim(),
      });
      setResult({ link: res.link, emailError: res.email_error });
      setStep("done");
      if (!res.email_error) toast.success(`Agreements sent to ${recipientEmail.trim()}`);
      await onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send agreements");
      setStep("form");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="max-w-xl rounded-2xl">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Send agreements</DialogTitle>
              <DialogDescription>
                The client gets one secure link to read, tick and sign every selected agreement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Booking</Label>
                <Select value={bookingId} onValueChange={(value) => setBookingId(String(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookable.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {bookingLabel(a)}
                      </SelectItem>
                    ))}
                    <SelectItem value={NO_BOOKING}>Not linked to a booking</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Agreements</Label>
                {templatesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active agreements. Create them in Settings → Agreements.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={Boolean(selected[t.id])}
                          onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [t.id]: Boolean(checked) }))}
                        />
                        <span className="flex-1 font-medium">{t.title}</span>
                        <span className="text-xs text-muted-foreground">v{t.version}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recipient-name">Recipient name</Label>
                  <Input id="recipient-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient-email">Recipient email</Label>
                  <Input
                    id="recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={chosen.length === 0 || !emailValid}>
                Review & send
              </Button>
            </DialogFooter>
          </>
        ) : step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Send this email now?</DialogTitle>
              <DialogDescription>Please check the details before the email goes out.</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">To</dt>
                <dd className="font-medium">
                  {recipientName.trim() || clientName} &lt;{recipientEmail.trim()}&gt;
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Booking</dt>
                <dd className="font-medium">{booking ? bookingLabel(booking) : "Not linked to a booking"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Agreements ({chosen.length})</dt>
                <dd className="font-medium">{chosen.map((t) => t.title).join(", ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Link valid for</dt>
                <dd className="font-medium">14 days</dd>
              </div>
            </dl>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={sending}>
                Back
              </Button>
              <Button onClick={() => void handleSend()} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send email
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{result?.emailError ? "Created, but the email failed" : "Agreements sent"}</DialogTitle>
              <DialogDescription>
                {result?.emailError ??
                  `${recipientEmail.trim()} will receive an email with the signing link. You'll see the result here once they sign.`}
              </DialogDescription>
            </DialogHeader>
            {result ? (
              <div className="flex gap-2">
                <Input readOnly value={result.link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button variant="outline" onClick={() => void copyLink(result.link)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
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

  const timeline: { label: string; at?: string }[] = detail
    ? [
        { label: `Sent to ${detail.recipient_email}`, at: detail.sent_at },
        { label: "Opened by client", at: detail.viewed_at },
        { label: `Signed by ${detail.signed_name ?? ""}`, at: detail.signed_at },
        { label: "Declined by client", at: detail.declined_at },
        { label: `Voided${detail.voided_by ? ` by ${detail.voided_by}` : ""}`, at: detail.voided_at },
      ].filter((e) => e.at)
    : [];

  return (
    <Dialog open={requestId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Agreement record {detail ? <StatusBadge status={detail.status} /> : null}
          </DialogTitle>
          <DialogDescription>
            {appt ? `Booking ${bookingLabel(appt)}` : "Not linked to a booking"}
          </DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <ol className="space-y-2 border-l pl-4 text-sm">
              {timeline.map((e) => (
                <li key={e.label} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <span className="font-medium">{e.label}</span>
                  <span className="text-muted-foreground"> — {formatClinicDateTime(e.at!)}</span>
                </li>
              ))}
            </ol>

            {detail.decline_reason ? (
              <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                Reason: “{detail.decline_reason}”
              </p>
            ) : null}

            <div className="space-y-3">
              {detail.items.map((item, index) => (
                <details key={item.id} className="group rounded-xl border">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
                    <span className="font-medium">
                      {index + 1}. {item.title}{" "}
                      <span className="text-xs font-normal text-muted-foreground">v{item.template_version}</span>
                    </span>
                    {item.accepted_at ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Agreed
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Show terms</span>
                    )}
                  </summary>
                  <div className="max-h-72 overflow-y-auto border-t p-3">
                    <CredentialsRichTextContent html={item.body_html ?? ""} className="text-sm text-foreground" />
                  </div>
                </details>
              ))}
            </div>

            {detail.status === "signed" ? (
              <div className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Signature</p>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void downloadPdf(detail.id)}>
                    <Download className="h-4 w-4 mr-1" /> Download signed PDF
                  </Button>
                </div>
                {detail.signature_data_url ? (
                  <div className="rounded-lg border bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- inline data: URL */}
                    <img src={detail.signature_data_url} alt={`Signature of ${detail.signed_name}`} className="max-h-32" />
                  </div>
                ) : null}
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Typed name</dt>
                    <dd className="font-medium">{detail.signed_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">IP address</dt>
                    <dd className="font-medium">{detail.signer_ip || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Device</dt>
                    <dd className="break-all">{detail.signer_user_agent || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Terms fingerprint (SHA-256)</dt>
                    <dd className="break-all font-mono">{detail.content_hash}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Signature fingerprint (SHA-256)</dt>
                    <dd className="break-all font-mono">{detail.signature_hash}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
