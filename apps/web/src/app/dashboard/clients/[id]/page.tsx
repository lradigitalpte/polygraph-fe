"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSignature,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  Phone,
  UserRound,
  Wallet,
} from "lucide-react";

import { CorporateClientOverview } from "@/components/dashboard/corporate-client-overview";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, HeroAction, PageHero } from "@/components/dashboard/ui-kit";
import { fetchBookingAgreementStatuses, type BookingAgreementStatus } from "@/lib/agreements";
import { isOrganizationClient } from "@/lib/client-types";
import { formatClientCode } from "@/lib/clients";
import { formatClinicClock, formatClinicDateLabel } from "@/lib/clinic-time";
import { fetchExamTypes, type AppointmentRecord } from "@/lib/exam-booking";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

function relativeDays(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days === -1) return "tomorrow";
  if (days < 0) return `in ${-days} days`;
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "AED", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
const isCompleted = (a: AppointmentRecord) => a.status.toLowerCase() === "completed";

/** What's still owed on one booking. Bookings on a prepaid (bulk) slot are billed elsewhere. */
function owed(a: AppointmentRecord) {
  if (isCancelled(a) || a.prepaid_slot_id) return 0;
  return Math.max(0, (a.exam_fee ?? 0) - (a.collected_amount ?? 0));
}

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  confirmed: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  scheduled: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  pending: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
  in_progress: "bg-primary/15 text-[oklch(0.45_0.12_39)] dark:text-primary",
  cancelled: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground",
};

function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize", STATUS_STYLE[key] ?? STATUS_STYLE.cancelled)}>
      {status.replace(/[_-]+/g, " ") || "—"}
    </span>
  );
}

function PaymentPill({ appointment }: { appointment: AppointmentRecord }) {
  if (isCancelled(appointment)) return null;
  if (appointment.prepaid_slot_id) {
    return <span className="text-xs text-muted-foreground">Prepaid</span>;
  }
  const fee = appointment.exam_fee ?? 0;
  if (fee <= 0) return null;
  const due = owed(appointment);
  if (due <= 0) return <span className="text-xs font-medium text-[#2D5A27] dark:text-emerald-300">Paid</span>;
  return (
    <span className="text-xs font-medium text-[#8A5A12] dark:text-amber-200">
      {formatMoney(due, appointment.fee_currency || "AED")} due
    </span>
  );
}

const AGREEMENT_LABEL: Record<string, { text: string; style: string }> = {
  signed: { text: "Agreements signed", style: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" },
  awaiting: { text: "Agreements awaiting signature", style: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" },
  declined: { text: "Agreements declined", style: "bg-destructive/10 text-destructive" },
  not_sent: { text: "Agreements not sent", style: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" },
};

export default function ClientOverviewPage() {
  const { client, appointments, documents, loading, error } = useClientDetail();
  const { can } = useCurrentUser();
  const [examTypeNames, setExamTypeNames] = React.useState<Record<number, string>>({});
  const [agreementState, setAgreementState] = React.useState<BookingAgreementStatus | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchExamTypes()
      .then((types) => {
        if (!cancelled) setExamTypeNames(Object.fromEntries(types.map((t) => [t.id, t.name])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = React.useMemo(
    () => [...appointments].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    [appointments],
  );
  const now = Date.now();
  const nextSession = React.useMemo(
    () =>
      [...appointments]
        .filter((a) => !isCancelled(a) && !isCompleted(a) && new Date(a.scheduled_at).getTime() >= now - 3 * 3600000)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "now" is read once per appointments change
    [appointments],
  );

  const canSeeAgreements = can("agreement:view");
  React.useEffect(() => {
    if (!nextSession || !canSeeAgreements) {
      setAgreementState(null);
      return;
    }
    let cancelled = false;
    fetchBookingAgreementStatuses([nextSession.id])
      .then((map) => {
        if (!cancelled) setAgreementState(map[nextSession.id] ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgreementState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [nextSession, canSeeAgreements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading overview…
      </div>
    );
  }

  if (error || !client) {
    return <div className="rounded-[26px] bg-destructive/5 p-6 text-destructive ring-1 ring-destructive/20">{error || "Client record not found."}</div>;
  }

  if (isOrganizationClient(client)) {
    return <CorporateClientOverview />;
  }

  const base = `/dashboard/clients/${client.id}`;
  const active = appointments.filter((a) => !isCancelled(a));
  const completed = appointments.filter(isCompleted);
  const examMinutes = completed.reduce((sum, a) => sum + (a.duration || 0), 0);
  const upcoming = active.filter((a) => !isCompleted(a) && new Date(a.scheduled_at).getTime() >= now);

  const dueByCurrency = new Map<string, number>();
  for (const a of appointments) {
    const due = owed(a);
    if (due > 0) {
      const cur = (a.fee_currency || "AED").toUpperCase();
      dueByCurrency.set(cur, (dueByCurrency.get(cur) ?? 0) + due);
    }
  }
  const dueEntries = Array.from(dueByCurrency.entries());
  const dueLabel = dueEntries.length === 0 ? formatMoney(0, "AED") : dueEntries.map(([cur, amt]) => formatMoney(amt, cur)).join(" + ");

  // Real activity: the latest session that has happened, or the newest file — not the record's edit date.
  const pastTimes = [
    ...appointments.filter((a) => new Date(a.scheduled_at).getTime() <= now).map((a) => a.scheduled_at),
    ...documents.map((d) => d.created_at),
  ]
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t));
  const lastActivity = pastTimes.length ? new Date(Math.max(...pastTimes)).toISOString() : undefined;

  const recent = sorted.slice(0, 5);
  const recentDocs = [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  const examTypeOf = (a: AppointmentRecord) =>
    (a.exam_type_id ? examTypeNames[a.exam_type_id] : undefined) || (a.notes || "").split("\n")[0].trim() || "Polygraph examination";
  const sessionHref = (a: AppointmentRecord) => `${base}/exams/${a.id}` as Route;
  const firstName = client.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHero
        tone="lavender"
        icon={UserRound}
        eyebrow={`Client · ${formatClientCode(client.id)}`}
        title={
          <>
            {client.name.split(" ").slice(0, -1).join(" ")} <strong className="font-semibold">{client.name.split(" ").slice(-1)[0]}</strong>
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {client.email ? (
              <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-[#FAF9F5]">
                <Mail aria-hidden="true" className="size-3.5" /> {client.email}
              </a>
            ) : null}
            {client.phone ? (
              <a href={`tel:${client.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-[#FAF9F5]">
                <Phone aria-hidden="true" className="size-3.5" /> {client.phone}
              </a>
            ) : null}
            <span>Client since {formatClinicDateLabel(client.created_at)}</span>
          </span>
        }
        actions={
          <>
            <HeroAction icon={FolderOpen} href={`${base}/details`}>
              Details
            </HeroAction>
            {can("appointment:create") ? (
              <HeroAction variant="primary" icon={CalendarPlus} href={`/dashboard/calendar/book?clientId=${client.id}`}>
                Book exam
              </HeroAction>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat
            label="Sessions"
            value={active.length}
            hint={`${completed.length} completed${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}`}
            icon={ClipboardCheck}
            accent="lavender"
          />
          <GlassStat label="Exam time" value={formatDuration(examMinutes)} hint="In completed sessions" icon={Clock} accent="sage" />
          <GlassStat
            label="Balance due"
            value={dueLabel}
            hint={dueEntries.length ? "Across unpaid sessions" : "Nothing outstanding"}
            icon={Wallet}
            accent="terracotta"
          />
          <GlassStat label="Last activity" value={lastActivity ? relativeDays(lastActivity) : "—"} hint={`${documents.length} file${documents.length === 1 ? "" : "s"} in vault`} icon={CalendarClock} accent="amber" />
        </div>
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Next session */}
          {nextSession ? (
            <section aria-labelledby="next-title" className={cn(CARD, "p-6")}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="next-title" className="text-[15px] font-medium">
                  Next session
                </h2>
                <span className="text-[13px] text-muted-foreground">{relativeDays(nextSession.scheduled_at)}</span>
              </div>
              <Link
                href={sessionHref(nextSession)}
                className="group mt-4 flex items-center gap-4 rounded-2xl bg-[#F7F6F1] p-4 transition-colors hover:bg-[#ECE9E0] dark:bg-muted/50 dark:hover:bg-muted"
              >
                <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-white py-2 text-center ring-1 ring-border/50 dark:bg-card">
                  <span className="text-[11px] font-medium text-primary uppercase">
                    {new Date(nextSession.scheduled_at).toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="text-xl leading-none font-semibold tabular-nums">{new Date(nextSession.scheduled_at).getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{examTypeOf(nextSession)}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {formatClinicDateLabel(nextSession.scheduled_at)} · {formatClinicClock(nextSession.scheduled_at)} · {formatDuration(nextSession.duration || 0)}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusPill status={nextSession.status} />
                {agreementState && AGREEMENT_LABEL[agreementState.state] ? (
                  <Link href={`${base}/approvals` as Route} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", AGREEMENT_LABEL[agreementState.state].style)}>
                    <FileSignature aria-hidden="true" className="size-3" />
                    {AGREEMENT_LABEL[agreementState.state].text}
                  </Link>
                ) : null}
                {nextSession.questions_prepared ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1E4] px-2.5 py-0.5 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 aria-hidden="true" className="size-3" /> Questions ready
                  </span>
                ) : (
                  <Link href={`${base}/questions` as Route} className="inline-flex rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">
                    Questions not prepared
                  </Link>
                )}
                {owed(nextSession) > 0 ? (
                  <Link href={`${base}/account` as Route} className="inline-flex rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">
                    {formatMoney(owed(nextSession), nextSession.fee_currency || "AED")} unpaid
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Sessions */}
          <section aria-labelledby="sessions-title" className={cn(CARD, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 p-6 pb-4">
              <div>
                <h2 id="sessions-title" className="text-[15px] font-medium">
                  Sessions
                </h2>
                <p className="text-[13px] text-muted-foreground">Newest first.</p>
              </div>
              {appointments.length > 0 ? (
                <Link href={`${base}/exams` as Route} className="flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
                  All {appointments.length} <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                  <ClipboardCheck aria-hidden="true" className="size-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="font-medium">No sessions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Book {firstName}&apos;s first exam to get started.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {recent.map((a) => (
                  <li key={a.id}>
                    <Link href={sessionHref(a)} className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                      <span className="w-24 shrink-0">
                        <span className="block text-sm font-medium tabular-nums">{formatClinicDateLabel(a.scheduled_at)}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{formatClinicClock(a.scheduled_at)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{examTypeOf(a)}</span>
                        <span className="block text-xs text-muted-foreground">
                          APT-{String(a.id).padStart(4, "0")} · {formatDuration(a.duration || 0)}
                        </span>
                      </span>
                      <span className="hidden shrink-0 sm:block">
                        <PaymentPill appointment={a} />
                      </span>
                      <StatusPill status={a.status} />
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Documents */}
          <section aria-labelledby="docs-title" className={cn(CARD, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 p-6 pb-4">
              <h2 id="docs-title" className="text-[15px] font-medium">
                Document vault
              </h2>
              <Link href={`${base}/documents` as Route} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
                Open
              </Link>
            </div>
            {recentDocs.length === 0 ? (
              <p className="border-t border-border/50 px-6 py-8 text-center text-sm text-muted-foreground">No files yet.</p>
            ) : (
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {recentDocs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-6 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F1EA] dark:bg-muted">
                      <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={d.name}>
                        {d.name}
                      </span>
                      <span className="block text-xs text-muted-foreground capitalize">
                        {(d.type || "file").replace(/[_-]+/g, " ")} · {relativeDays(d.created_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Shortcuts */}
          <nav aria-label="Client shortcuts" className={cn(CARD, "grid grid-cols-2 gap-2 p-3")}>
            {[
              { label: "Session questions", href: `${base}/questions`, icon: ClipboardCheck },
              { label: "Secure reports", href: `${base}/reports`, icon: FileText },
              { label: "Approvals", href: `${base}/approvals`, icon: FileSignature },
              { label: "Account & billing", href: `${base}/account`, icon: Wallet },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href as Route}
                className="flex items-center gap-2.5 rounded-2xl px-3 py-3 text-[13px] font-medium transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                <s.icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
