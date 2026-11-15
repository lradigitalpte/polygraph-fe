"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Inbox,
  Loader2,
  Mail,
  RefreshCcw,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassStat, HeroAction, PageHero, Segmented } from "@/components/dashboard/ui-kit";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { authenticatedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types + API                                                        */
/* ------------------------------------------------------------------ */

type IntakeRequest = {
  id: number;
  token: string;
  recipient_email: string;
  recipient_name: string;
  message?: string;
  status: string;
  expires_at: string;
  created_at: string;
  submitted_at?: string;
  agreed_at?: string;
  sent_by_email?: string;
};

type SubmittedSubject = {
  id?: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  employee_ref?: string;
  nationality?: string;
  gender?: string;
};

type IntakeSubmission = {
  id: number;
  client_id: number;
  client_name: string;
  status: string;
  submitted_at?: string;
  agreed_at?: string;
  subjects: SubmittedSubject[];
};

/** The request is saved even when the email fails; the API then returns a warning. */
async function sendIntakeRequest(input: {
  client_id: number;
  recipient_email: string;
  recipient_name: string;
  message: string;
  expiry_days: number;
}): Promise<{ request: IntakeRequest; warning?: string }> {
  const res = await authenticatedFetch("/api/intake-requests", { method: "POST", body: JSON.stringify(input) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  if (data?.intake_request) return { request: data.intake_request as IntakeRequest, warning: data.warning };
  return { request: data as IntakeRequest };
}

async function fetchIntakeRequests(clientId: number): Promise<IntakeRequest[]> {
  const res = await authenticatedFetch(`/api/intake-requests?client_id=${clientId}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Failed to load roster requests");
  return (data ?? []) as IntakeRequest[];
}

async function resendIntakeRequest(id: number): Promise<void> {
  const res = await authenticatedFetch(`/api/intake-requests/${id}/resend`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Failed to resend (${res.status})`);
  }
}

async function fetchIntakeSubmission(id: number): Promise<IntakeSubmission> {
  const res = await authenticatedFetch(`/api/intake-requests/${id}/submission`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Failed to load submission");
  return data as IntakeSubmission;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-2xl border-0 bg-[#F7F6F1] ring-1 ring-black/[0.05] focus-visible:ring-2 focus-visible:ring-primary dark:bg-muted dark:ring-white/10";
const PILL = "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted";
const EXPIRY_CHOICES = [3, 7, 14, 30] as const;
const MAX_EXPIRY = 30;
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const PAGE = 8;

type Status = "pending" | "submitted" | "expired";
type Filter = "all" | Status;

function intakeLink(token: string) {
  // The public roster form lives on the frontend, not the API.
  return `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${token}`;
}

function isPlaceholderEmail(email: string) {
  const e = email.trim().toLowerCase();
  return e.endsWith("@import.local") || e.endsWith(".local") || e.endsWith("@example.com") || e.endsWith(".invalid");
}

/** Pending links past their date can't be used, whatever the stored status says. */
function effectiveStatus(req: IntakeRequest): Status {
  if (req.status === "submitted") return "submitted";
  if (req.status === "expired" || new Date(req.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function expiryDateFor(days: number) {
  return fmtDate(new Date(Date.now() + days * 86_400_000).toISOString());
}

async function copyText(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
  } catch {
    toast.error("Couldn't copy. Link: " + text);
  }
}

const STATUS_CHIP: Record<Status, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" },
  submitted: { label: "Submitted", className: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" },
  expired: { label: "Expired", className: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" },
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

type Draft = { email: string; name: string; message: string; days: number };

export default function RequestRosterPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const { client } = useClientDetail();
  const formRef = React.useRef<HTMLDivElement>(null);

  const [draft, setDraft] = React.useState<Draft>({ email: "", name: "", message: "", days: 7 });
  const [touched, setTouched] = React.useState(false);
  const [prefilled, setPrefilled] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ request: IntakeRequest; warning?: string } | null>(null);

  const [history, setHistory] = React.useState<IntakeRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [shown, setShown] = React.useState(PAGE);
  const [remindId, setRemindId] = React.useState<number | null>(null);
  const [resendingId, setResendingId] = React.useState<number | null>(null);
  const [loadingSubmissionId, setLoadingSubmissionId] = React.useState<number | null>(null);
  const [viewing, setViewing] = React.useState<IntakeSubmission | null>(null);

  // Pre-fill once from the client record (not on every client refresh, so typing isn't overwritten).
  React.useEffect(() => {
    if (!client || prefilled) return;
    const email = client.email && !isPlaceholderEmail(client.email) ? client.email : "";
    setDraft((d) => ({ ...d, email: d.email || email, name: d.name || (client.contact_person ?? "") }));
    setPrefilled(true);
  }, [client, prefilled]);

  const loadHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      setHistory(await fetchIntakeRequests(clientId));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load roster requests");
    } finally {
      setLoadingHistory(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const withStatus = React.useMemo(() => history.map((r) => ({ ...r, eff: effectiveStatus(r) })), [history]);
  const counts = React.useMemo(() => {
    const c = { all: withStatus.length, pending: 0, submitted: 0, expired: 0 };
    for (const r of withStatus) c[r.eff]++;
    return c;
  }, [withStatus]);
  const filtered = filter === "all" ? withStatus : withStatus.filter((r) => r.eff === filter);
  const openForSameEmail = withStatus.find(
    (r) => r.eff === "pending" && r.recipient_email.toLowerCase() === draft.email.trim().toLowerCase(),
  );

  React.useEffect(() => setShown(PAGE), [filter]);

  const emailOk = EMAIL_RE.test(draft.email.trim());
  const placeholder = isPlaceholderEmail(draft.email);
  const canReview = emailOk && !placeholder && draft.days >= 1 && draft.days <= MAX_EXPIRY;
  const orgName = client?.name ?? "this organisation";

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function review(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canReview) return;
    setConfirming(true);
  }

  async function send() {
    setSending(true);
    try {
      const res = await sendIntakeRequest({
        client_id: clientId,
        recipient_email: draft.email.trim(),
        recipient_name: draft.name.trim(),
        message: draft.message.trim(),
        expiry_days: draft.days,
      });
      setResult(res);
      setHistory((prev) => [res.request, ...prev]);
      setConfirming(false);
      setDraft((d) => ({ ...d, message: "" }));
      setTouched(false);
      if (res.warning) toast.warning("Link created, but the email didn't go out");
      else toast.success(`Roster request emailed to ${res.request.recipient_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send roster request");
    } finally {
      setSending(false);
    }
  }

  async function remind(id: number) {
    setResendingId(id);
    try {
      await resendIntakeRequest(id);
      toast.success("Reminder emailed");
      setRemindId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
      void loadHistory();
    } finally {
      setResendingId(null);
    }
  }

  async function view(id: number) {
    setLoadingSubmissionId(id);
    try {
      setViewing(await fetchIntakeSubmission(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setLoadingSubmissionId(null);
    }
  }

  function sendAgain(req: IntakeRequest) {
    setDraft({ email: req.recipient_email, name: req.recipient_name ?? "", message: req.message ?? "", days: 7 });
    setResult(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHero
        tone="sage"
        icon={Mail}
        eyebrow="Examinee roster"
        title={
          <>
            Request a <strong className="font-semibold">roster</strong>
          </>
        }
        description={`Email ${orgName} a secure link where they list the people to be examined. No login needed — names land straight in the roster.`}
        actions={
          <HeroAction icon={Users} href={`/dashboard/clients/${clientId}/roster`}>
            Open roster
          </HeroAction>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Requests sent" value={counts.all} loading={loadingHistory} accent="ink" icon={Send} />
          <GlassStat label="Waiting" value={counts.pending} hint="Link open, not filled in" loading={loadingHistory} accent="amber" icon={Clock} />
          <GlassStat label="Submitted" value={counts.submitted} hint="Ready to schedule" loading={loadingHistory} accent="sage" icon={CheckCircle2} />
          <GlassStat label="Expired" value={counts.expired} hint="Send a new one if needed" loading={loadingHistory} accent="terracotta" icon={X} />
        </div>
      </PageHero>

      {result ? <SentBanner result={result} onClose={() => setResult(null)} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        {/* ---------------- New request ---------------- */}
        <div ref={formRef} className={cn(CARD, "scroll-mt-6 p-5 sm:p-7")}>
          <h2 className="text-lg font-semibold tracking-[-0.01em]">New roster request</h2>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;ll check the email before it&apos;s sent.</p>

          <form onSubmit={review} className="mt-6 space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Send to</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="hr@organisation.com"
                  className={cn(FIELD, touched && (!emailOk || placeholder) && "ring-2 ring-destructive/60")}
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => draft.email && setTouched(true)}
                  aria-invalid={touched && (!emailOk || placeholder) ? true : undefined}
                  aria-describedby="email-hint"
                />
                <p id="email-hint" className="min-h-4 text-xs">
                  {touched && !emailOk ? (
                    <span className="text-destructive">Enter one valid email address.</span>
                  ) : placeholder ? (
                    <span className="text-destructive">This is a placeholder address — it can&apos;t receive email.</span>
                  ) : null}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Their name <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="name" placeholder="e.g. HR Manager" className={FIELD} value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </div>
            </div>

            {openForSameEmail ? (
              <div className="flex items-start gap-2.5 rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {openForSameEmail.recipient_email} already has an open link (sent {fmtDate(openForSameEmail.created_at)}, open until{" "}
                  {fmtDate(openForSameEmail.expires_at)}). A reminder may be better than a second link.
                </span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="message">
                Note to include <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="message"
                rows={3}
                maxLength={1000}
                placeholder="e.g. Please list everyone booked for examination on 20 June."
                className="rounded-2xl border-0 bg-[#F7F6F1] ring-1 ring-black/[0.05] focus-visible:ring-2 focus-visible:ring-primary dark:bg-muted dark:ring-white/10"
                value={draft.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Link stays open for</Label>
              <div className="flex flex-wrap items-center gap-2">
                {EXPIRY_CHOICES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={draft.days === d}
                    onClick={() => set("days", d)}
                    className={cn(
                      "h-9 rounded-full px-4 text-[13px] font-medium ring-1 transition-colors",
                      draft.days === d
                        ? "bg-[#2B2A27] text-[#FAF9F5] ring-[#2B2A27] dark:bg-[#FAF9F5] dark:text-[#1A1915]"
                        : "ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted",
                    )}
                  >
                    {d} days
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Open until {expiryDateFor(draft.days)}. A reminder doesn&apos;t extend this.</p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <FileText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Consent or questionnaire forms are sent from the{" "}
                  <Link href={`/dashboard/clients/${clientId}/documents`} className="font-medium text-foreground underline underline-offset-2">
                    Document vault
                  </Link>
                  .
                </span>
              </p>
              <button
                type="submit"
                className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-105 disabled:opacity-50"
              >
                <Eye aria-hidden="true" className="size-4" /> Review email
              </button>
            </div>
          </form>
        </div>

        {/* ---------------- History ---------------- */}
        <div className={cn(CARD, "p-5 sm:p-7")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">Sent requests</h2>
            {history.length > 0 ? (
              <Segmented<Filter>
                label="Filter requests"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "pending", label: "Waiting", count: counts.pending },
                  { value: "submitted", label: "Submitted", count: counts.submitted },
                  { value: "expired", label: "Expired", count: counts.expired },
                ]}
              />
            ) : null}
          </div>

          <div className="mt-5">
            {loadingHistory ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
                ))}
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-destructive">{historyError}</p>
                <button type="button" className={PILL} onClick={() => void loadHistory()}>
                  <RefreshCcw aria-hidden="true" className="size-3.5" /> Try again
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#F7F6F1] px-6 py-12 text-center dark:bg-muted/40">
                <span className="flex size-12 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm dark:bg-card">
                  <Inbox aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-1 font-medium">No requests sent yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  When {orgName} fills in the form, you&apos;ll see it here and can schedule everyone they listed.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing in this view.</p>
            ) : (
              <ul className="space-y-2.5">
                {filtered.slice(0, shown).map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    status={req.eff}
                    clientId={clientId}
                    reminding={remindId === req.id}
                    resending={resendingId === req.id}
                    loadingSubmission={loadingSubmissionId === req.id}
                    onAskRemind={() => setRemindId(req.id)}
                    onCancelRemind={() => setRemindId(null)}
                    onRemind={() => void remind(req.id)}
                    onView={() => void view(req.id)}
                    onSendAgain={() => sendAgain(req)}
                  />
                ))}
              </ul>
            )}
            {filtered.length > shown ? (
              <button type="button" className={cn(PILL, "mx-auto mt-4")} onClick={() => setShown((s) => s + PAGE)}>
                Show {Math.min(PAGE, filtered.length - shown)} more
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---------------- Confirm send ---------------- */}
      <Dialog open={confirming} onOpenChange={(open) => !sending && setConfirming(open)}>
        <DialogContent className="max-w-lg rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Send this roster request?</DialogTitle>
            <DialogDescription>An email with a secure link goes out as soon as you confirm.</DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-border/60 rounded-2xl bg-[#F7F6F1] px-4 text-sm dark:bg-muted/40">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">To</dt>
              <dd className="truncate text-right font-medium">
                {draft.name.trim() ? `${draft.name.trim()} · ` : ""}
                {draft.email.trim()}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">For</dt>
              <dd className="text-right font-medium">{orgName}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Link open until</dt>
              <dd className="text-right font-medium">
                {expiryDateFor(draft.days)} <span className="font-normal text-muted-foreground">({draft.days} days)</span>
              </dd>
            </div>
            {draft.message.trim() ? (
              <div className="py-3">
                <dt className="text-muted-foreground">Your note</dt>
                <dd className="mt-1 whitespace-pre-wrap">{draft.message.trim()}</dd>
              </div>
            ) : null}
          </dl>
          {openForSameEmail ? (
            <p className="text-xs text-[#8A5A12] dark:text-amber-300">They already have an open link — this sends a second one.</p>
          ) : null}
          <DialogFooter className="gap-2">
            <button type="button" className={PILL} onClick={() => setConfirming(false)} disabled={sending}>
              Back
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {sending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
              {sending ? "Sending…" : "Send email"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubmissionDialog viewing={viewing} onClose={() => setViewing(null)} clientId={clientId} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                             */
/* ------------------------------------------------------------------ */

function SentBanner({ result, onClose }: { result: { request: IntakeRequest; warning?: string }; onClose: () => void }) {
  const link = intakeLink(result.request.token);
  const failed = Boolean(result.warning);
  return (
    <div
      role="status"
      className={cn(
        "rounded-[26px] p-5 ring-1 sm:p-6",
        failed
          ? "bg-[#F8EEDB] text-[#5C3D0C] ring-[#E9D3A8] dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-900"
          : "bg-[#E7F1E4] text-[#2D5A27] ring-[#CFE3C9] dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {failed ? <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
          <div>
            <p className="font-semibold">
              {failed ? "The link was created, but the email didn't go out" : `Emailed to ${result.request.recipient_email}`}
            </p>
            <p className="mt-0.5 text-sm opacity-90">
              {failed
                ? "Copy the link below and send it yourself, or try a reminder later."
                : `The link is open until ${fmtDate(result.request.expires_at)}. You can also share it yourself.`}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-full p-1.5 hover:bg-black/5">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-full bg-white/70 px-4 py-2.5 font-mono text-xs dark:bg-black/30">{link}</code>
        <button
          type="button"
          onClick={() => void copyText(link, "Link copied")}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] hover:bg-[#3A3935]"
        >
          <Copy aria-hidden="true" className="size-3.5" /> Copy link
        </button>
      </div>
    </div>
  );
}

function RequestRow({
  req,
  status,
  clientId,
  reminding,
  resending,
  loadingSubmission,
  onAskRemind,
  onCancelRemind,
  onRemind,
  onView,
  onSendAgain,
}: {
  req: IntakeRequest;
  status: Status;
  clientId: number;
  reminding: boolean;
  resending: boolean;
  loadingSubmission: boolean;
  onAskRemind: () => void;
  onCancelRemind: () => void;
  onRemind: () => void;
  onView: () => void;
  onSendAgain: () => void;
}) {
  const chip = STATUS_CHIP[status];
  const left = daysLeft(req.expires_at);
  let detail: React.ReactNode;
  if (status === "submitted") {
    detail = (
      <>
        Submitted {fmtDate(req.submitted_at)}
        {req.agreed_at ? (
          <span className="ml-2 inline-flex items-center gap-1 text-[#2D5A27] dark:text-emerald-300" title={`Declaration accepted ${fmtDateTime(req.agreed_at)}`}>
            <ShieldCheck aria-hidden="true" className="size-3.5" /> Declaration signed
          </span>
        ) : null}
      </>
    );
  } else if (status === "expired") {
    detail = <>Sent {fmtDate(req.created_at)} · expired {fmtDate(req.expires_at)}</>;
  } else {
    detail = (
      <>
        Sent {fmtDate(req.created_at)} ·{" "}
        <span className={cn(left <= 2 && "font-medium text-[#8A5A12] dark:text-amber-300")}>
          {left <= 1 ? "expires within a day" : `${left} days left`}
        </span>
      </>
    );
  }

  return (
    <li className="rounded-2xl bg-[#F7F6F1] p-4 ring-1 ring-black/[0.03] dark:bg-muted/40 dark:ring-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{req.recipient_name || req.recipient_email}</p>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", chip.className)}>{chip.label}</span>
          </div>
          {req.recipient_name ? <p className="truncate text-xs text-muted-foreground">{req.recipient_email}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {status === "pending" && !reminding ? (
            <>
              <button type="button" className={cn(PILL, "bg-white dark:bg-card")} onClick={() => void copyText(intakeLink(req.token), "Link copied")}>
                <Copy aria-hidden="true" className="size-3.5" /> Copy link
              </button>
              <button type="button" className={cn(PILL, "bg-white dark:bg-card")} onClick={onAskRemind}>
                <RefreshCcw aria-hidden="true" className="size-3.5" /> Remind
              </button>
            </>
          ) : null}
          {status === "submitted" ? (
            <>
              <button type="button" className={cn(PILL, "bg-white dark:bg-card")} onClick={onView} disabled={loadingSubmission}>
                {loadingSubmission ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Eye aria-hidden="true" className="size-3.5" />}
                View
              </button>
              <Link
                href={`/dashboard/clients/${clientId}/intake/${req.id}`}
                className="flex h-9 items-center gap-1.5 rounded-full bg-[#2B2A27] px-3.5 text-[13px] font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-[#FAF9F5] dark:text-[#1A1915]"
              >
                <CalendarClock aria-hidden="true" className="size-3.5" /> Schedule
              </Link>
            </>
          ) : null}
          {status === "expired" ? (
            <button type="button" className={cn(PILL, "bg-white dark:bg-card")} onClick={onSendAgain}>
              <Send aria-hidden="true" className="size-3.5" /> Send a new link
            </button>
          ) : null}
        </div>
      </div>

      {status === "pending" && reminding ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-white p-3 text-[13px] sm:flex-row sm:items-center sm:justify-between dark:bg-card">
          <span>
            Email a reminder to <strong className="font-medium">{req.recipient_email}</strong>? The link still closes {fmtDate(req.expires_at)}.
          </span>
          <span className="flex shrink-0 gap-1.5">
            <button type="button" className={PILL} onClick={onCancelRemind} disabled={resending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={onRemind}
              disabled={resending}
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {resending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Check aria-hidden="true" className="size-3.5" />}
              Send reminder
            </button>
          </span>
        </div>
      ) : null}
    </li>
  );
}

const SUB_PAGE = 25;

function SubmissionDialog({ viewing, onClose, clientId }: { viewing: IntakeSubmission | null; onClose: () => void; clientId: number }) {
  const [query, setQuery] = React.useState("");
  const [shown, setShown] = React.useState(SUB_PAGE);

  React.useEffect(() => {
    setQuery("");
    setShown(SUB_PAGE);
  }, [viewing?.id]);

  const subjects = viewing?.subjects ?? [];
  const q = query.trim().toLowerCase();
  const list = q
    ? subjects.filter((s) =>
        [s.first_name, s.last_name, s.email, s.phone, s.employee_ref].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
    : subjects;

  return (
    <Dialog open={viewing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto rounded-[26px]">
        <DialogHeader>
          <DialogTitle>Submitted examinees</DialogTitle>
          <DialogDescription>
            {subjects.length} {subjects.length === 1 ? "person" : "people"} listed by {viewing?.client_name}
            {viewing?.submitted_at ? ` on ${fmtDate(viewing.submitted_at)}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {viewing ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#E7F1E4] px-4 py-3 text-[13px] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-200">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                {viewing.agreed_at ? (
                  <>
                    Declaration accepted {fmtDateTime(viewing.agreed_at)}: the submitter confirmed the details are accurate and agreed to their use for examinations.
                  </>
                ) : (
                  <>Submitted {fmtDateTime(viewing.submitted_at)}. No declaration time was recorded.</>
                )}
              </span>
            </div>

            {subjects.length > 8 ? (
              <Input placeholder="Search name, email, phone or ref…" className={FIELD} value={query} onChange={(e) => setQuery(e.target.value)} />
            ) : null}

            <div className="overflow-x-auto rounded-2xl ring-1 ring-border/60">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Contact</th>
                    <th className="px-4 py-2.5 font-medium">Ref / ID</th>
                    <th className="px-4 py-2.5 font-medium">Nationality</th>
                    <th className="px-4 py-2.5 font-medium">Gender</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {list.slice(0, shown).map((s, i) => {
                    const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
                    return (
                      <tr key={s.id ?? `row-${i}`}>
                        <td className="px-4 py-2.5 font-medium">{name || <span className="text-muted-foreground italic">No name</span>}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          <div className="truncate">{s.email || "—"}</div>
                          {s.phone ? <div className="text-xs">{s.phone}</div> : null}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.employee_ref || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.nationality || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">{s.gender || "—"}</td>
                      </tr>
                    );
                  })}
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No one matches “{query}”.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {list.length > shown ? (
              <button type="button" className={cn(PILL, "mx-auto")} onClick={() => setShown((n) => n + SUB_PAGE)}>
                Show {Math.min(SUB_PAGE, list.length - shown)} more
              </button>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <button type="button" className={PILL} onClick={onClose}>
            Close
          </button>
          {viewing ? (
            <Link
              href={`/dashboard/clients/${clientId}/intake/${viewing.id}`}
              className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            >
              <CalendarClock aria-hidden="true" className="size-3.5" /> Schedule these
            </Link>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
